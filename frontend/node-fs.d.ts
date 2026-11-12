// The one Node API vite.config.ts uses (reading ../VERSION), typed by hand so
// the project does not need @types/node. Delete this file if @types/node is
// ever added.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
