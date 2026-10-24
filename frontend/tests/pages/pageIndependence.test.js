// The Exploration Map (src/pages/DrillMap) and Techno Map (src/pages/TechnoMap)
// each own a full copy of the map code so they can diverge. These checks keep
// either page from quietly depending on, or leaking into, the other.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";

const PAGES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/pages");

const PAGES = [
  { name: "DrillMap", other: "TechnoMap", rootClass: "drill-map-page", css: "DrillMap.css" },
  { name: "TechnoMap", other: "DrillMap", rootClass: "techno-map-page", css: "TechnoMap.css" },
];

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);

    return [".ts", ".tsx", ".css"].includes(extname(entry.name)) ? [path] : [];
  });
}

// Every module specifier: static/side-effect imports, re-exports, dynamic
// import(), and CSS @import.
function importSpecifiers(source) {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/g,
  ];

  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]));
}

const isInside = (path, dir) => {
  const rel = relative(dir, path);

  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`) && !rel.startsWith(sep));
};

// Selectors of every style rule, skipping at-rule preludes and @keyframes steps.
function styleRuleSelectors(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = [];
  const selectors = [];
  let start = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === ";") {
      start = i + 1;
    } else if (char === "}") {
      stack.pop();
      start = i + 1;
    } else if (char === "{") {
      const prelude = source.slice(start, i).trim();
      start = i + 1;
      if (prelude.startsWith("@")) {
        stack.push(/^@(-\w+-)?keyframes\b/.test(prelude) ? "keyframes" : "at-rule");
      } else if (stack.at(-1) === "keyframes") {
        stack.push("keyframe");
      } else {
        stack.push("rule");
        selectors.push(...prelude.split(",").map((selector) => selector.trim()));
      }
    }
  }

  return selectors;
}

describe("page config independence", () => {
  it("gives each page its own config object", () => {
    expect(drillConfig.MAP_CONFIG).not.toBe(technoConfig.MAP_CONFIG);
    expect(drillConfig.MAP_SETTINGS).not.toBe(technoConfig.MAP_SETTINGS);
    expect(drillConfig.MAP_ID).not.toBe(technoConfig.MAP_ID);
  });

  it.each(["zoom", "redox", "markerLabels", "legendSymbols"])(
    "shares no '%s' object between the pages",
    (key) => {
      expect(drillConfig.MAP_CONFIG[key]).not.toBe(technoConfig.MAP_CONFIG[key]);
    },
  );

  it("leaves the Techno Map untouched when a copy of the Exploration config changes", () => {
    const before = structuredClone(technoConfig.MAP_CONFIG);
    const copy = structuredClone(drillConfig.MAP_CONFIG);

    copy.title = "Changed";
    copy.zoom.deviationMinZoom = 99;
    copy.gtRanges[0].color = "#123456";
    copy.markerLabels.rig = "Changed rig";

    expect(technoConfig.MAP_CONFIG).toEqual(before);
    expect(technoConfig.MAP_CONFIG.title).toBe("Techno Map");
    expect(technoConfig.DRILLHOLE_TYPE_CONFIG.producer.color).toBe(before.drillholeTypes.find(({ id }) => id === "producer").color);
  });

  it("leaves the Exploration Map untouched when a copy of the Techno config changes", () => {
    const before = structuredClone(drillConfig.MAP_CONFIG);
    const copy = structuredClone(technoConfig.MAP_CONFIG);

    copy.title = "Changed";
    copy.zoom.deviationMinZoom = 99;
    copy.markers.size = 99;
    copy.drillholeTypes.pop();

    expect(drillConfig.MAP_CONFIG).toEqual(before);
    expect(drillConfig.MAP_CONFIG.title).toBe("Exploration Map");
    expect(drillConfig.getGtRange(0).color).toBe(before.gtRanges[0].color);
  });
});

describe.each(PAGES)("$name source independence", ({ name, other, rootClass, css }) => {
  const pageDir = join(PAGES_DIR, name);
  const otherDir = join(PAGES_DIR, other);
  const files = sourceFiles(pageDir);

  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.endsWith(".css"))).toBe(true);
  });

  it(`imports nothing from ${other}`, () => {
    const offenders = files.flatMap((file) => importSpecifiers(readFileSync(file, "utf8"))
      .filter((specifier) => {
        if (specifier.includes(`pages/${other}`)) return true;
        if (!specifier.startsWith(".")) return false;

        return isInside(resolve(dirname(file), specifier), otherDir);
      })
      .map((specifier) => `${relative(PAGES_DIR, file)} -> ${specifier}`));

    expect(offenders).toEqual([]);
  });

  it("finds the imports it scans (scanner sanity check)", () => {
    const specifiers = importSpecifiers(readFileSync(join(pageDir, `${name}.tsx`), "utf8"));

    expect(specifiers).toContain(`./${css}`);
  });

  it(`scopes every selector in ${css} under .${rootClass}`, () => {
    const selectors = styleRuleSelectors(readFileSync(join(pageDir, css), "utf8"));
    const scoped = new RegExp(`^\\.${rootClass}(?![\\w-])`);

    expect(selectors.length).toBeGreaterThan(10);
    expect(selectors.filter((selector) => !scoped.test(selector))).toEqual([]);
  });

  it(`never mentions the other page's root class in ${css}`, () => {
    const otherClass = PAGES.find((page) => page.name === other).rootClass;

    expect(readFileSync(join(pageDir, css), "utf8")).not.toContain(otherClass);
  });
});
