// The website version, from the VERSION file at the repository root (the one
// place it is kept; see VERSIONING.md). vite.config.ts inlines the file's
// text as __APP_VERSION__ at build time.

/** MAJOR.MINOR.PATCH.BUILD: four whole numbers, e.g. 1.1.1.1. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

export function isValidVersion(text: string): boolean {
  return VERSION_PATTERN.test(text);
}

/** What the sidebar shows: the version, or 'dev' when the file is missing or malformed. */
export function readVersion(text: string): string {
  const version = text.trim();

  return isValidVersion(version) ? version : 'dev';
}

export const APP_VERSION = readVersion(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '');
