#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SOURCE="$ROOT/../app/static"
DEST="$ROOT/app/src/main/assets"
mkdir -p "$DEST/static"
cp "$SOURCE/index.html" "$DEST/index.html"
find "$DEST/static" -type f -delete
cp -R "$SOURCE"/. "$DEST/static"/
# The index is served from the assets root; all referenced /static/* files come from the copy above.
echo "EarnRoute web assets synchronized into Android project."
