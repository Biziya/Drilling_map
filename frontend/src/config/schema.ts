/**
 * Minimal typed validation for the YAML configuration files.
 *
 * YAML is parsed at build time by @rollup/plugin-yaml, so each file arrives as
 * a plain object of unknown shape. A parser checks that shape once at module
 * load and returns a typed, frozen value. Invalid configuration throws a
 * `ConfigError` naming the offending path instead of letting a missing number
 * surface later as a NaN somewhere on the map.
 */

export type Parser<T> = (value: unknown, path: string) => T;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

function fail(path: string, expected: string, value: unknown): never {
  throw new ConfigError(`${path}: expected ${expected}, got ${JSON.stringify(value)}`);
}

export const text: Parser<string> = (value, path) =>
  typeof value === 'string' && value.trim() !== '' ? value : fail(path, 'a non-empty string', value);

export const number: Parser<number> = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a finite number', value);

export const boolean: Parser<boolean> = (value, path) =>
  typeof value === 'boolean' ? value : fail(path, 'true or false', value);

export function oneOf<const T extends string>(...allowed: T[]): Parser<T> {
  return (value, path) =>
    allowed.includes(value as T) ? (value as T) : fail(path, `one of ${allowed.join(', ')}`, value);
}

export function list<T>(item: Parser<T>): Parser<T[]> {
  return (value, path) =>
    Array.isArray(value) ? value.map((entry, index) => item(entry, `${path}[${index}]`)) : fail(path, 'a list', value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A map with arbitrary keys, every value checked by `item`. */
export function dictionary<T>(item: Parser<T>): Parser<Record<string, T>> {
  return (value, path) => {
    if (!isRecord(value)) return fail(path, 'a mapping', value);

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, item(entry, `${path}.${key}`)]),
    );
  };
}

type Shape = Record<string, Parser<unknown>>;
type Parsed<S extends Shape> = { [K in keyof S]: ReturnType<S[K]> };

/** A mapping with exactly the listed keys. Unknown keys are rejected as likely typos. */
export function object<S extends Shape>(shape: S): Parser<Parsed<S>> {
  return (value, path) => {
    if (!isRecord(value)) return fail(path, 'a mapping', value);

    const unknownKey = Object.keys(value).find((key) => !(key in shape));
    if (unknownKey) throw new ConfigError(`${path}.${unknownKey}: unknown setting`);

    const result: Record<string, unknown> = {};
    for (const [key, parse] of Object.entries(shape)) {
      result[key] = parse(value[key], `${path}.${key}`);
    }

    return result as Parsed<S>;
  };
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
}

/** Validates one configuration file. `file` prefixes every error path. */
export function parseConfig<T>(parser: Parser<T>, data: unknown, file: string): Readonly<T> {
  return deepFreeze(parser(data, file));
}
