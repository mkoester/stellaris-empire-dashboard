#!/usr/bin/env bash
# The game a release was built for, for its GitHub notes (.github/workflows/release.yml):
#   game-version.sh <extractor's sql/stellaris.sql> [<openBeta>]
# A beta build names package.json's openBeta; any other build the dump's meta.game_version.
set -euo pipefail
dump=$1 beta=${2:-}
if [ -n "$beta" ]; then
	echo "the Stellaris $beta open beta"
	exit
fi
version=$(sed -n "s/^INSERT OR REPLACE INTO meta (key, value) VALUES ('game_version', '\(.*\)');\$/\1/p" "$dump")
[ -n "$version" ] || { echo "::error::no meta.game_version in $dump" >&2; exit 1; }
echo "Stellaris $version"
