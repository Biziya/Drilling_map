// Bumps the website version: rewrites VERSION at the repository root and adds
// a dated section to the top of CHANGELOG.md for you to fill in.
//
//   npm run version:bump -- major|minor|patch|build
//
// The rules (what each part means, when to bump it) are in VERSIONING.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PARTS = ['major', 'minor', 'patch', 'build'];
const VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

/** The next version: the chosen part goes up by one, every part to its right back to 0. */
export function bumpVersion(version, part) {
  const index = PARTS.indexOf(part);
  if (index < 0) throw new Error(`Choose what to bump: ${PARTS.join(', ')}.`);
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`VERSION must be four whole numbers like 1.1.1.1, found "${version}".`);
  }

  return version
    .split('.')
    .map(Number)
    .map((value, position) => (position < index ? value : position === index ? value + 1 : 0))
    .join('.');
}

/** YYYY-MM-DD in local time. */
export function today(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The changelog with an empty section for `version` above the newest one. */
export function addChangelogSection(changelog, version, date) {
  const section = `## ${version} - ${date}\n\n- \n\n`;
  const newest = changelog.search(/^## /m);
  if (newest < 0) return `${changelog.trimEnd()}\n\n${section}`;

  return changelog.slice(0, newest) + section + changelog.slice(newest);
}

/** Bumps the files under `root` (the repository root) and returns the new version. */
export function bumpFiles(root, part, date = today()) {
  const versionFile = join(root, 'VERSION');
  const changelogFile = join(root, 'CHANGELOG.md');
  const next = bumpVersion(readFileSync(versionFile, 'utf8').trim(), part);
  const changelog = readFileSync(changelogFile, 'utf8').replace(/\r\n/g, '\n');

  writeFileSync(versionFile, `${next}\n`);
  writeFileSync(changelogFile, addChangelogSection(changelog, next, date));

  return next;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  try {
    const next = bumpFiles(repositoryRoot, process.argv[2]);
    console.log(`Version ${next}. Now describe the change under "## ${next}" in CHANGELOG.md.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
