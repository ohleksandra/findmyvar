#!/usr/bin/env node
// Zips the dist/ folder contents (NOT the folder itself) into
// findmyvar-v<version>.zip at the repo root. The resulting archive is
// what gets uploaded to the Figma plugin marketplace.
//
// Requires the `zip` command-line tool. macOS and most Linux distros
// have it preinstalled. On Windows, install via Git for Windows,
// WSL, or substitute archiver/adm-zip in a future iteration.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');

if (!existsSync(distDir)) {
	console.error('error: dist/ does not exist. Run `npm run build` first.');
	process.exit(1);
}

const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const zipName = `findmyvar-v${version}.zip`;
const zipPath = resolve(root, zipName);

const files = readdirSync(distDir);
if (files.length === 0) {
	console.error('error: dist/ is empty. Run `npm run build` first.');
	process.exit(1);
}

console.log(`Packaging ${files.length} file(s) from dist/ into ${zipName}...`);

try {
	execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
} catch (error) {
	if (error.code === 'ENOENT') {
		console.error(
			'error: `zip` command not found. Install it (e.g. `brew install zip` on macOS) or use a Node-based zipper.',
		);
		process.exit(1);
	}
	throw error;
}

console.log(`Done. Upload ${zipName} to Figma to publish.`);
