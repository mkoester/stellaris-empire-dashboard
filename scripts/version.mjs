#!/usr/bin/env node
// package.json's version, decorated with git state (OKF vault, practices/git-and-workspaces.md,
// "Artifact versioning"): as-is on a clean `main` or a commit tagged `v<version>` (the release
// workflow builds from the tag, a detached HEAD), `-<hash>` on any other commit, `-SNAPSHOT` with
// uncommitted changes. Shown in the header and used in the release zips' names.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** @param {...string} args */
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function decoratedVersion() {
	const base = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
	try {
		if (git('status', '--porcelain', '--untracked-files=no') !== '') return `${base}-SNAPSHOT`;
		if (git('branch', '--show-current') === 'main') return base;
		if (git('tag', '--points-at', 'HEAD').split('\n').includes(`v${base}`)) return base;
		return `${base}-${git('rev-parse', '--short', 'HEAD')}`;
	} catch {
		return base; // no git (a source archive)
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(decoratedVersion());
