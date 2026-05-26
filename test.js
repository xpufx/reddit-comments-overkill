#!/usr/bin/env node
// Regression test for date, dot, and x detection.
// Usage:
//   1. Save your Reddit comments page as test-page.html (or pass filename as arg)
//   2. Run: node test.js [filename]

const fs = require('fs');

// Config — matches script defaults
const DAYS_TO_PRESERVE = 10;

const filename = process.argv[2] || 'test-page.html';
const html = fs.readFileSync(filename, 'utf-8');
const now = Date.now();
const cutoff = now - DAYS_TO_PRESERVE * 86400000;

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, '-', detail); }
}

console.log('=== Date detection test ===');
console.log('  Today:', new Date(now).toISOString().slice(0,10));
console.log('  Cutoff:', new Date(cutoff).toISOString().slice(0,10));
console.log('  Preserve:', DAYS_TO_PRESERVE, 'days\n');

const timeRegex = /<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/g;
let match;
const results = [];
while ((match = timeRegex.exec(html)) !== null) {
  const raw = match[1];
  const text = match[2].trim();
  const d = new Date(raw);
  const valid = !isNaN(d.getTime());
  const age = valid ? (now - d.getTime()) / 86400000 : NaN;
  const shouldSkip = valid ? d.getTime() >= cutoff : true;

  results.push({ raw, text, valid, age, shouldSkip });
  check(raw + ' (' + text + ')', valid, 'new Date() returned NaN');
}

// Verify expected outcomes based on actual dates in test page
const expectedSkips = results.filter(r => r.shouldSkip);
const expectedDeletes = results.filter(r => !r.shouldSkip);
check(expectedSkips.length + ' should skip', expectedSkips.length === 5, 'got ' + expectedSkips.length);
check(expectedDeletes.length + ' should delete', expectedDeletes.length === 3, 'got ' + expectedDeletes.length);

console.log('\n=== Dot/x detection test ===');
const mdRegex = /<div class="md">(.*?)<\/div>/gs;
let mdMatch;
let dotCount = 0;
let xCount = 0;
let mdTotal = 0;
while ((mdMatch = mdRegex.exec(html)) !== null) {
  mdTotal++;
  const md = mdMatch[1];
  const lastP = md.match(/<p>([^<]*)<\/p>\s*$/);
  if (lastP) {
    const lastText = lastP[1].trim();
    if (lastText === '.') dotCount++;
    if (lastText === 'x') xCount++;
  }
}
check(mdTotal + ' .md elements', mdTotal > 0, 'none found');
check('Comments ending with "." = 2', dotCount === 2, 'got ' + dotCount);
check('Comments ending with "x" = 0', xCount === 0, 'got ' + xCount);

console.log('\n=== Summary ===');
console.log('  Passed:', passed);
console.log('  Failed:', failed);
if (failed) process.exit(1);
