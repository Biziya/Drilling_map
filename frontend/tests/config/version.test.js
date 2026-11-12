// The website version: VERSION at the repository root, its changelog entry,
// and the bump script. See VERSIONING.md.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APP_VERSION, isValidVersion, readVersion } from "../../src/config/version.js";
import { addChangelogSection, bumpFiles, bumpVersion, today } from "../../scripts/bump-version.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const read = (name) => readFileSync(join(ROOT, name), "utf8").replace(/\r\n/g, "\n");

describe("VERSION and CHANGELOG.md", () => {
  it("VERSION is four whole numbers, and is what the app shows", () => {
    const version = read("VERSION").trim();

    expect(isValidVersion(version)).toBe(true);
    expect(APP_VERSION).toBe(version);
  });

  it("the newest changelog section is for the current version (bump and changelog go together)", () => {
    const newest = read("CHANGELOG.md").match(/^## (\S+) - (\d{4}-\d{2}-\d{2})$/m);

    expect(newest, "CHANGELOG.md needs a '## <version> - <YYYY-MM-DD>' section").not.toBeNull();
    expect(newest[1]).toBe(read("VERSION").trim());
  });
});

describe("readVersion", () => {
  it("trims the file and falls back to 'dev' for anything that is not four numbers", () => {
    expect(readVersion("1.1.1.1\n")).toBe("1.1.1.1");
    expect(readVersion("1.2.3")).toBe("dev");
    expect(readVersion("v1.1.1.1")).toBe("dev");
    expect(readVersion("")).toBe("dev");
  });
});

describe("bumpVersion", () => {
  it("raises one part and resets the parts to its right", () => {
    expect(bumpVersion("1.1.1.1", "build")).toBe("1.1.1.2");
    expect(bumpVersion("1.1.1.1", "patch")).toBe("1.1.2.0");
    expect(bumpVersion("1.1.1.1", "minor")).toBe("1.2.0.0");
    expect(bumpVersion("1.1.1.1", "major")).toBe("2.0.0.0");
    expect(bumpVersion("1.9.9.9", "patch")).toBe("1.9.10.0");
  });

  it("refuses a missing or unknown part, or a malformed version", () => {
    expect(() => bumpVersion("1.1.1.1", undefined)).toThrow(/major, minor, patch, build/);
    expect(() => bumpVersion("1.1.1.1", "huge")).toThrow(/major, minor, patch, build/);
    expect(() => bumpVersion("1.1.1", "patch")).toThrow(/four whole numbers/);
  });
});

describe("bumpFiles", () => {
  let dir = null;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  it("rewrites VERSION and adds a dated section above the newest one", () => {
    dir = mkdtempSync(join(tmpdir(), "version-"));
    writeFileSync(join(dir, "VERSION"), "1.1.1.1\n");
    writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\nIntro.\n\n## 1.1.1.1 - 2026-11-12\n\n- First.\n");

    expect(bumpFiles(dir, "patch", "2026-11-13")).toBe("1.1.2.0");
    expect(readFileSync(join(dir, "VERSION"), "utf8")).toBe("1.1.2.0\n");
    expect(readFileSync(join(dir, "CHANGELOG.md"), "utf8")).toBe(
      "# Changelog\n\nIntro.\n\n## 1.1.2.0 - 2026-11-13\n\n- \n\n## 1.1.1.1 - 2026-11-12\n\n- First.\n",
    );
  });

  it("leaves both files alone when the bump is refused", () => {
    dir = mkdtempSync(join(tmpdir(), "version-"));
    writeFileSync(join(dir, "VERSION"), "1.1.1.1\n");
    writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n");

    expect(() => bumpFiles(dir, "nope")).toThrow();
    expect(readFileSync(join(dir, "VERSION"), "utf8")).toBe("1.1.1.1\n");
    expect(readFileSync(join(dir, "CHANGELOG.md"), "utf8")).toBe("# Changelog\n");
  });

  it("adds the first section to a changelog that has none, and dates it today", () => {
    expect(addChangelogSection("# Changelog\n", "1.0.0.0", "2026-01-02")).toBe("# Changelog\n\n## 1.0.0.0 - 2026-01-02\n\n- \n\n");
    expect(today(new Date(2026, 0, 2))).toBe("2026-01-02");
  });
});
