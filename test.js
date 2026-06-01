#!/usr/bin/env node
// Regression test suite for date, dot, and x detection.
// Uses src/detection.js for logic — single source of truth.
//
// Each test-sample*.html can include an annotation comment:
//   <!-- TEST: days=10 skip=8 delete=3 dots=1 x=0 -->
// If present, the test asserts results match the annotation.
// If absent, counts are reported without assertion (warn only).
//
// To add a new sample:
//   1. Save your Reddit comments page as test-sample-N.html
//   2. Run: node test.js
//   3. Copy the "Suggested annotation" line into the file header
//   4. Re-run to verify
//
// Usage:
//   node test.js                        # run all test-sample*.html files
//   node test.js some-file.html         # run a single file

const fs = require('fs');
const {
  shouldSkipCommentByDate,
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
  const msg = (ok, name, detail) => {
    if (ok) { passed++; }
    else { failed++; console.log('    FAIL:', name, (detail ? '- ' + detail : '')); }
  };

  let html;
  try { html = fs.readFileSync(file, 'utf-8'); }
  catch (e) { console.log('  ERROR: cannot read ' + file); totalFailed++; continue; }

  // Parse annotation from HTML comment
  const annotMatch = html.match(/<!--\s*TEST:\s*(.*?)\s*-->/);
  let annot = {};
  if (annotMatch) {
    for (const part of annotMatch[1].split(/\s+/)) {
      const [k, v] = part.split('=');
      if (k && v !== undefined) annot[k] = isNaN(v) ? v : Number(v);
    }
  }
  const days = annot.days !== undefined ? annot.days : 10;

  console.log('--- ' + file + ' ---');
  console.log('  Today:', new Date().toISOString().slice(0,10));
  console.log('  Preserve:', days, 'days');
  console.log('  Detection: src/detection.js');
  if (annotMatch) {
    console.log('  Annotation:', annotMatch[1]);
  } else {
    console.log('  (no annotation — counts reported without assertion)');
  }

  // Test date detection
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
    msg(valid, raw + ' - "' + text + '"', 'new Date() returned NaN');
    if (valid) {
      const createdUtc = d.getTime() / 1000;
      if (shouldSkipCommentByDate(createdUtc, days)) skipByDate++;
      else deleteByDate++;
    }
  }
  msg(timeCount > 0, 'Dates parse', 'no time elements found');
  if (annot.skip !== undefined) msg(skipByDate === annot.skip,
    'Date skip=' + annot.skip, 'got ' + skipByDate);
  if (annot.delete !== undefined) msg(deleteByDate === annot['delete'],
    'Date delete=' + annot['delete'], 'got ' + deleteByDate);

  // Test dot/x detection
  const mdRe = /<div class="md">(.*?)<\/div>/gs;
  let mdM;
  let mdTotal = 0, dotCount = 0, xCount = 0;
  while ((mdM = mdRe.exec(html)) !== null) {
    mdTotal++;
    const text = mdM[1].replace(/<[^>]+>/g, ' ').replace(/&#[^;]+;/g, ' ').trim();
    if (shouldSkipCommentByDot(text, true)) dotCount++;
    if (shouldDeleteCommentByX(text, true)) xCount++;
  }
  msg(mdTotal > 0, '.md elements found', 'none found');
  if (annot.dots !== undefined) msg(dotCount === annot.dots,
    'Dots=' + annot.dots, 'got ' + dotCount);
  if (annot.x !== undefined) msg(xCount === annot.x,
    'X=' + annot.x, 'got ' + xCount);

  // If no annotation, suggest one
  if (!annotMatch) {
    console.log('  Suggested annotation: days=' + days + ' skip=' + skipByDate + ' delete=' + deleteByDate + ' dots=' + dotCount + ' x=' + xCount);
  }

  console.log('  Times: ' + timeCount + ' | .md: ' + mdTotal);
  console.log('  Date: ' + skipByDate + ' skip, ' + deleteByDate + ' delete | Dots: ' + dotCount + ' | X: ' + xCount);
  console.log('  ' + passed + ' / ' + (passed + failed) + ' passed');

  totalPassed += passed;
  totalFailed += failed;
}

console.log('');
console.log('=== Final: ' + totalPassed + ' passed, ' + totalFailed + ' failed across ' + totalFiles + ' file(s) ===');
process.exit(totalFailed ? 1 : 0);
