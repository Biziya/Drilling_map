import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_FEATURES_URL, loadSiteFeatures, parseSiteFeatures, resetSiteFeaturesCache } from "../../../src/services/siteFeatures/siteFeatures.js";

const YAML_TEXT = readFileSync(resolve(import.meta.dirname, "../../../public/site_features/site_features.yaml"), "utf8");

describe("parseSiteFeatures", () => {
  it("reads both features from the shipped YAML, in UTM 49N", () => {
    const features = parseSiteFeatures(load(YAML_TEXT));

    expect(features.map(({ id, name, type, iconSrc, areaHa }) => ({ id, name, type, iconSrc, areaHa }))).toEqual([
      { id: "pilot_factory", name: "Zoovch Pilot", type: "pilot_factory", iconSrc: "/pilot_factory.svg", areaHa: 1.34 },
      { id: "mud_pit", name: "Mud pit", type: "mud_pit", iconSrc: "/mud_pit.svg", areaHa: 10.26 },
    ]);
    const [pilot, mudPit] = features;
    expect(pilot.lonLat).toEqual([110.012374, 44.189857]);
    // The icon sits inside its own footprint.
    expect(pilot.utm.x).toBeGreaterThan(420998);
    expect(pilot.utm.x).toBeLessThan(421144);
    expect(mudPit.utm.x).toBeGreaterThan(421479);
    expect(mudPit.utm.x).toBeLessThan(421829);
    expect(mudPit.utm.y).toBeGreaterThan(4892101);
    expect(mudPit.utm.y).toBeLessThan(4892396);
    // outline_utm is used as given.
    expect(mudPit.outlineUtm[1]).toEqual({ x: 421828.9, y: 4892395.4 });
  });

  it("picks the icon by type when an entry names none, and converts a lon/lat outline", () => {
    const [feature] = parseSiteFeatures({
      source_crs: "EPSG:32649",
      features: [{ id: "tank_1", name: "Tank", type: "water_tank", position: [110.02, 44.18], outline: [[110.01, 44.17], [110.03, 44.17], [110.03, 44.19], [110.01, 44.17]] }],
    });

    expect(feature.iconSrc).toBe("/water_tank.svg");
    expect(feature.areaHa).toBeNull();
    expect(feature.outlineUtm).toHaveLength(4);
    expect(feature.outlineUtm[0].x).toBeGreaterThan(420000);
  });

  it("skips a malformed or duplicate entry with a warning and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const features = parseSiteFeatures({
      features: [
        { id: "a", name: "A", type: "mud_pit", position: [110, 44] },
        { id: "b", name: "B", type: "mud_pit", position: ["x", 44] },
        { id: "a", name: "A again", type: "mud_pit", position: [110, 44] },
        null,
      ],
    });

    expect(features.map(({ id }) => id)).toEqual(["a"]);
    // Three bad entries, plus "a" having no outline.
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  it("rejects a file with no features list", () => {
    expect(() => parseSiteFeatures({ crs: "EPSG:4326" })).toThrow(/features/);
    expect(() => parseSiteFeatures(null)).toThrow(/features/);
  });
});

describe("loadSiteFeatures", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetSiteFeaturesCache());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("fetches the YAML once and shares the result", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(YAML_TEXT) }));

    const [first, second] = await Promise.all([loadSiteFeatures(), loadSiteFeatures()]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(SITE_FEATURES_URL);
    expect(first).toHaveLength(2);
    expect(second).toBe(first);
  });

  it.each([
    ["a missing file", () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") })],
    ["a network failure", () => Promise.reject(new Error("offline"))],
    ["broken YAML", () => Promise.resolve({ ok: true, text: () => Promise.resolve("features: [oops") })],
    ["an HTML fallback page", () => Promise.resolve({ ok: true, headers: new Headers({ "content-type": "text/html" }), text: () => Promise.resolve("<!doctype html>") })],
  ])("logs one clear error and returns no features on %s", async (_case, fetchImpl) => {
    globalThis.fetch = vi.fn(fetchImpl);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(loadSiteFeatures()).resolves.toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/\[site-features\] Could not load/);
  });
});
