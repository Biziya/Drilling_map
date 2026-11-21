import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { lonLatToUtm, utmZoneFromEpsg } from "../../src/utils/utm.js";

const SITE_FEATURES = load(readFileSync(resolve(import.meta.dirname, "../../public/site_features/site_features.yaml"), "utf8"));

describe("utmZoneFromEpsg", () => {
  it("reads north and south WGS 84 UTM zones, and rejects anything else", () => {
    expect(utmZoneFromEpsg("EPSG:32649")).toEqual({ zone: 49, south: false });
    expect(utmZoneFromEpsg("epsg:32733")).toEqual({ zone: 33, south: true });
    expect(utmZoneFromEpsg("EPSG:4326")).toBeNull();
    expect(utmZoneFromEpsg("EPSG:32661")).toBeNull();
    expect(utmZoneFromEpsg(undefined)).toBeNull();
  });
});

describe("lonLatToUtm", () => {
  it("puts the central meridian on the 500 km false easting", () => {
    const { x, y } = lonLatToUtm(111, 0, 49);

    expect(x).toBeCloseTo(500000, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it("mirrors east and west of the central meridian, and adds the southern false northing", () => {
    const east = lonLatToUtm(112, 44, 49);
    const west = lonLatToUtm(110, 44, 49);

    expect(east.x - 500000).toBeCloseTo(500000 - west.x, 6);
    expect(east.y).toBeCloseTo(west.y, 6);
    expect(lonLatToUtm(110, -44, 49, true).y).toBeCloseTo(10000000 - west.y, 6);
  });

  // The YAML's UTM corners come from the GIS export, so they are an independent reference.
  it("reproduces every site-feature corner in the YAML to within 2 m", () => {
    for (const feature of SITE_FEATURES.features) {
      feature.outline.forEach(([lon, lat], index) => {
        const [east, north] = feature.outline_utm[index];
        const { x, y } = lonLatToUtm(lon, lat, 49);

        expect(Math.abs(x - east), `${feature.id} corner ${index} easting`).toBeLessThan(2);
        expect(Math.abs(y - north), `${feature.id} corner ${index} northing`).toBeLessThan(2);
      });
    }
  });
});
