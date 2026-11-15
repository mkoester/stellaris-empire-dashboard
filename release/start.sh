#!/usr/bin/env sh
# Starts the Stellaris Empire Dashboard and opens it in the browser. Ctrl+C stops it.
# Options: --lan  also serve other devices on your network (e.g. a tablet as the second screen)
set -eu
cd "$(dirname "$0")"

# The game data is read from your install with Python (once per game version, a few seconds).
if [ -z "${STELLARIS_DATA_DB:-}" ] &&
	! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
	echo "The dashboard needs Python 3.10 or newer, as 'python3', to read the game's data." >&2
	echo "Install python3 with your distribution's package manager, then start it again." >&2
	exit 1
fi

chmod u+x node/bin/node 2>/dev/null || true
exec ./node/bin/node launcher.mjs "$@"
