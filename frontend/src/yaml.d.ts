// YAML files are parsed at build time; each config module casts its file to a typed shape.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
