#!/usr/bin/env sh
# Starts the Stellaris Empire Dashboard and opens it in the browser: double-click it in Finder.
# Closing its Terminal window (or Ctrl+C) stops it.
# Options, from a terminal: --lan  also serve other devices on your network (e.g. a tablet)
set -eu
cd "$(dirname "$0")"

# A downloaded zip marks every file in it as quarantined, and macOS would then refuse the bundled
# Python (not notarized) as well. The player has let this script run, so clear the mark on the
# folder's own files.
xattr -dr com.apple.quarantine . 2>/dev/null || true

chmod u+x node/bin/node python/bin/python3 2>/dev/null || true
exec ./node/bin/node launcher.mjs "$@"
