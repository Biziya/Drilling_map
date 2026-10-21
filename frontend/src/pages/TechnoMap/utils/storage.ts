// Settings kept across browser refreshes. Storage can be blocked, full or
// cleared at any time, so a failed read is "nothing stored" and a failed
// write only means the setting is not remembered.

export function readStored(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);

    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; the page works the same.
  }
}
