# AGENTS.md — reddit-comments-overkill

Single-file userscript (`reddit-comments-overkill.user.js`). No build, no tests, no linting, no package manager.

## Setup

- No local dev tooling needed. Edit the `.user.js` file directly.
- Test by loading the script in Violentmonkey (recommended) or Tampermonkey on `old.reddit.com/user/*/comments*`.

## Script structure

- **Config constants** at the top of the IIFE (lines 23–34): `SORTS`, `WAIT_FOR_COMMENTS_MS`, `daysToPreserve`, `preserveDotComments`, `dryRun`.
- **State persistence**: URL params (`rco_sort`, `rco_days`, `rco_dot`, `rco_dryrun`) survive page reloads. The `history.replaceState` update at line 119 does NOT trigger reload.
- **Rate limiting**: `fetch` and `XMLHttpRequest` both monkey-patched at lines 181–229. Exponential backoff starts at 60s, doubles per 429, caps at 30min.
- **Sort cycling**: `["new", "hot", "top", "controversial"]`. Navigation via `location.href` assignment (line 288), so page reloads happen between sorts.

## Gotchas (learned the hard way)

- **`gotoSort()` must preserve ALL `rco_*` params** — it only kept `rco_sort` before, dropping `rco_days`, `rco_dot`, `rco_dryrun` on navigation. Preserve loop uses `for (const key of ['rco_sort', 'rco_days', 'rco_dot', 'rco_dryrun'])`.
- **`runSort()` must `return true`** when a sort finishes — missing return meant sorts were never marked complete and `idx` never advanced, causing infinite loop on the last sort.
- **Dot detection**: Use `element.innerText` not `element.textContent` — Reddit minifies HTML (`<p>text</p><p>.</p>`) so `textContent` concatenates to `"text."` with no `\n`. `innerText` respects block boundaries. Also strip Unicode whitespace (NBSP, etc.) that `.trim()` misses: `[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]`.
- **Date comparison**: `new Date()` runs in local timezone; Reddit `datetime` may be UTC or timezone-naive. The primary strategy now is to parse the human-readable text ("10 days ago") from `timeEl.textContent` — this avoids timezone bugs entirely. The `datetime` attribute is a fallback only. Log both values for diagnosis. On the user comments page the `time[datetime]` selector works; `querySelector` is scoped to the comment element from `.closest()`.
- **Comment element scope**: `deleteBtn.closest('.comment, .thing, .entry, [id^=t1_]')` returns `.entry` on old Reddit. `querySelector` on `.entry` finds `.usertext-body > .md`. If `.usertext-body` is missing (e.g. collapsed preview), fall back to `.md` alone.

## Conventions

- Commit style: lowercase imperative mood (`bump version to 2.23`, `clean up dead code`).
- No semantic versioning — bumps are manual integer increments in the `@version` header.
- Only one file matters: `reddit-comments-overkill.user.js`.
