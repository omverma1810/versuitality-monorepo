#!/usr/bin/env bash
# Two-pass build so the contents page carries real page numbers.
#   bash docs/user-manual/build.sh        (needs: node + @playwright/test, python + pymupdf)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../../apps/web"
rm -f "$HERE/.toc-pages.json"
python3 "$HERE/compress_images.py"
node "$HERE/build-manual.mjs"
python3 "$HERE/toc_pages.py"
node "$HERE/build-manual.mjs"
