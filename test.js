#!/usr/bin/env node
// Regression test suite for date, dot, and x detection.
// Uses src/detection.js for logic — single source of truth.
//
// To add a new sample:
//   1. Save your Reddit comments page as test-sample-N.html
//   2. Run: node test.js
//   3. Review the output
//
// Usage:
//   node test.js                        # run all test-sample*.html files
//   node test.js some-file.html         # run a single file

const fs = require('fs');
const {
  shouldSkipCommentByDate,
  loneLineCheck,
  shouldSkipCommentByDot,
  shouldDeleteCommentByX
} = require('./src/detection.js');

const glob = process.argv[2];
const files = glob
  ? [glob]
  : fs.readdirSync('.').filter(f => /^test-sample[\w-]*\.html$/i.test(f));

if (!files.length) {
  console.log('No test-sample*.html files found.');
  console.log('Save a Reddit comments page as test-sample.html and re-run.');
  process.exit(1);
}

console.log('Found ' + files.length + ' test file(s): ' + files.join(', '));
console.log('');

let totalPassed = 0;
let totalFailed = 0;
let totalFiles = 0;

for (const file of files) {
  totalFiles++;
  let passed = 0;
  let failed = 0;
  const check = (name, ok, detail) => {
    if (ok) passed++;
    else { failed++; console.log('    FAIL:', name, (detail ? '- ' + detail : '')); }
  };

  let html;
  try { html = fs.readFileSync(file, 'utf-8'); }
  catch (e) { console.log('  ERROR: cannot read ' + file); totalFailed++; continue; }

  const DAYS = 10;
  const now = Date.now();
  const cutoff = now - DAYS * 86400000;

  console.log('--- ' + file + ' ---');
  console.log('  Today:', new Date(now).toISOString().slice(0,10));
  console.log('  Preserve:', DAYS, 'days - Cutoff:', new Date(cutoff).toISOString().slice(0,10));
  console.log('  Detection logic from: src/detection.js');

  // Date detection — tests both format and logic
  const timeRe = /<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/g;
  let m;
  let timeCount = 0;
  let skipByDate = 0, deleteByDate = 0;
  while ((m = timeRe.exec(html)) !== null) {
    timeCount++;
    const raw = m[1];
    const text = m[2].trim();
    const d = new Date(raw);
    const valid = !isNaN(d.getTime());
    check(raw + ' - "' + text + '"', valid, 'new Date() returned NaN');

    if (valid) {
      const createdUtc = d.getTime() / 1000;
      const skip = shouldSkipCommentByDate(createdUtc, DAYS);
      if (skip) skipByDate++; else deleteByDate++;
    }
  }
  check('Dates parse', timeCount > 0, 'no time elements found');
  console.log('  Date filter: ' + skipByDate + ' preserve, ' + deleteByDate + ' delete');

  // Dot/x detection — format check (can't test full logic without DOM textContent)
  const mdRe = /<div class="md">(.*?)<\/div>/gs;
  let mdM;
  let mdTotal = 0, dotCount = 0, xCount = 0;
  while ((mdM = mdRe.exec(html)) !== null) {
    mdTotal++;
    const lastP = mdM[1].match(/<p>([^<]*)<\/p>\s*$/);
    if (lastP) {
      const t = lastP[1].trim();
      if (t === '.') dotCount++;
      if (t === 'x') xCount++;
    }
  }
  check('.md elements found', mdTotal > 0, 'none found');
  console.log('  .md: ' + mdTotal + ' | Dots: ' + dotCount + ' | X: ' + xCount);
  console.log('  Passed: ' + passed + ' / ' + (passed + failed));

  totalPassed += passed;
  totalFailed += failed;
}

console.log('');
console.log('=== Final: ' + totalPassed + ' passed, ' + totalFailed + ' failed across ' + totalFiles + ' file(s) ===');
process.exit(totalFailed ? 1 : 0);
