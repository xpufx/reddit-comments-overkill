#!/usr/bin/env bash
set -euo pipefail

SCRIPT="reddit-comments-overkill.user.js"
README="README.md"
NO_BLOCK=0
for arg in "$@"; do
	case "$arg" in
	--no-block | -y) NO_BLOCK=1 ;;
	esac
done

echo "=== Release check ==="

# 0. Run regression tests against all samples
if [ -f "test.js" ]; then
	echo "  Running regression tests..."
	if node test.js; then
		echo "  Tests passed"
	else
		echo "  ERROR: Regression tests failed"
		exit 1
	fi
fi

# 1. Extract versions
meta_ver=$(grep -oP '// @version\s+\K\S+' "$SCRIPT")
const_ver=$(grep -oP 'const VERSION\s*=\s*"\K[^"]+' "$SCRIPT")

echo "  Metadata version: $meta_ver"
echo "  VERSION constant: $const_ver"

if [ "$meta_ver" != "$const_ver" ]; then
	echo "  ERROR: Version mismatch between metadata ($meta_ver) and VERSION constant ($const_ver)"
	exit 1
fi

# 3. Check for uncommitted changes
if ! git diff --quiet HEAD; then
	echo "  WARNING: Uncommitted changes exist"
	git diff --stat HEAD
fi

# 4. Check tag doesn't already exist
if git tag -l "v$meta_ver" | grep -q .; then
	echo "  ERROR: Tag v$meta_ver already exists"
	exit 1
fi

echo
echo "Reminder: update README if new features were added."
echo "Tip: use --no-block to skip this prompt next time."
if [ "$NO_BLOCK" -eq 0 ]; then
	echo "Press Enter to continue or Ctrl+C to abort..."
	read -r
fi

echo
echo "=== Tagging v$meta_ver ==="
git tag -a "v$meta_ver" -m "v$meta_ver"
git push origin "v$meta_ver"

echo
echo "=== Done ==="
echo "Tag v$meta_ver created and pushed."
echo
echo "Create a GitHub release at:"
echo "  https://github.com/xpufx/reddit-comments-overkill/releases/new?tag=v$meta_ver"
