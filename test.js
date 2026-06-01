#!/usr/bin/env node
// Regression test for date, dot, and x detection.
// Usage:
//   node test.js [filename]
//   Default filename: test-sample.html

const fs = require('fs');
const filename = process.argv[2] || 'test-sample.html';
const html = fs.readFileSync(filename, 'utf-8');

const DAYS = 10;
const now = Date.now();
const cutoff = now - DAYS * 86400000;

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; }
  else { failed++; console.log('  FAIL:', name, '-', detail); }
}

console.log('=== Date detection test ===');
console.log('  File:', filename);
console.log('  Today:', new Date(now).toISOString().slice(0,10));
console.log('  Preserve days:', DAYS, '- Cutoff:', new Date(cutoff).toISOString().slice(0,10));

const timeRe = /<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/g;
let m;
const times = [];
while ((m = timeRe.exec(html)) !== null) {
  const raw = m[1];
  const text = m[2].trim();
  const d = new Date(raw);
  const valid = !isNaN(d.getTime());
  const age = valid ? ((now - d.getTime()) / 86400000).toFixed(1) : '?';
  const skip = valid ? d.getTime() >= cutoff : true;
  times.push({ raw, text, valid, age, skip });
  check(raw + ' - "' + text + '"', valid, 'new Date() returned NaN');
}

const skips = times.filter(t => t.skip);
const deletes = times.filter(t => !t.skip);
console.log('\n  ' + skips.length + ' skip, ' + deletes.length + ' delete');
console.log('  All dates valid:', times.every(t => t.valid) ? 'yes' : 'NO');

console.log('\n=== Dot/x detection test ===');
const mdRe = /<div class="md">(.*?)<\/div>/gs;
let mdM;
let dotCount = 0, xCount = 0, mdTotal = 0;
while ((mdM = mdRe.exec(html)) !== null) {
  mdTotal++;
  const lastP = mdM[1].match(/<p>([^<]*)<\/p>\s*$/);
  if (lastP) {
    const t = lastP[1].trim();
    if (t === '.') dotCount++;
    if (t === 'x') xCount++;
  }
}
check(mdTotal + ' .md elements found', mdTotal > 0, 'none found');

console.log('\n=== Summary ===');
console.log('  Times:  ' + times.length + ' (' + skips.length + ' skip, ' + deletes.length + ' delete)');
console.log('  .md:    ' + mdTotal);
console.log('  Dots:   ' + dotCount);
console.log('  X:      ' + xCount);
console.log('  Passed: ' + passed + ' / ' + (passed + failed));
process.exit(failed ? 1 : 0);
