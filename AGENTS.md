# Agent notes

## Speed costs accuracy

Every bug in this session came from one root cause: making edits without re-reading the full surrounding context first.

**The rule:** before every edit, read at least 10 lines above and below the target. Verify:
- Variable declarations exist before first use (no TDZ errors).
- DOM elements are appended to their parent before being referenced.
- The order of operations matches what the code actually does, not what you assume it does.

No more fix-up commits. One shot.
