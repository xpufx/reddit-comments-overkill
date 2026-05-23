#!/usr/bin/env bash
set -euo pipefail

SCRIPT="reddit-comments-overkill.user.js"
README="README.md"

echo "=== Release check ==="

# 1. Extract versions
meta_ver=$(grep -oP '// @version\s+\K\S+' "$SCRIPT")
const_ver=$(grep -oP 'const VERSION\s*=\s*"\K[^"]+' "$SCRIPT")

echo "  Metadata version: $meta_ver"
echo "  VERSION constant: $const_ver"

if [ "$meta_ver" != "$const_ver" ]; then
	echo "  ERROR: Version mismatch between metadata ($meta_ver) and VERSION constant ($const_ver)"
	exit 1
fi

# 2. Check README has the version somewhere
if grep -q "$meta_ver" "$README" 2>/dev/null; then
	echo "  README mentions version: yes"
else
	echo "  WARNING: README does not mention version $meta_ver"
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
echo "=== Tagging v$meta_ver ==="
git tag -a "v$meta_ver" -m "v$meta_ver"
git push origin "v$meta_ver"

echo
echo "=== Done ==="
echo "Tag v$meta_ver created and pushed."
echo
echo "To create a GitHub release, go to:"
echo "  https://github.com/xpufx/reddit-comments-overkill/releases/new?tag=v$meta_ver"
echo
echo "Or from command line if you have 'gh' installed:"
echo "  gh release create v$meta_ver --generate-notes"
