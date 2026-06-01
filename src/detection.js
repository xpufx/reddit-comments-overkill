// Shared detection logic — used by both userscripts and test.js.
// During development: scripts @require this file.
// On release: release.sh inlines it into the .user.js bundle.

function shouldSkipCommentByDate(createdUtc, daysToPreserve) {
  if (createdUtc == null || isNaN(createdUtc)) return true;
  return (Date.now() / 1000 - createdUtc) / 86400 <= daysToPreserve;
}

function loneLineCheck(text, char) {
  if (!text) return false;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.some(l => l === char);
}

function shouldSkipCommentByDot(text, preserveDotComments) {
  return preserveDotComments && loneLineCheck(text, '.');
}

function shouldDeleteCommentByX(text, xMeansDelete) {
  return xMeansDelete && loneLineCheck(text, 'x');
}

if (typeof module !== 'undefined') module.exports = { shouldSkipCommentByDate, loneLineCheck, shouldSkipCommentByDot, shouldDeleteCommentByX };
