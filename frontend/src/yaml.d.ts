// YAML files are parsed at build time; their contents stay untrusted until a
// parser from config/schema.ts has validated them.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
