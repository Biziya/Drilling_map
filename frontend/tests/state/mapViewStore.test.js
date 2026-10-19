import { afterEach, describe, expect, it } from "vitest";
import {
  clearAllMapViews,
  clearMapView,
  readMapView,
  writeMapView,
} from "../../src/state/mapViewStore.js";

const FALLBACK = Object.freeze({ scale: 1, translateX: 0, translateY: 0 });
const ZOOMED = Object.freeze({ scale: 4, translateX: -120, translateY: 60 });

afterEach(clearAllMapViews);

describe("mapViewStore", () => {
  it("returns the fallback view for a key it has never seen", () => {
    expect(readMapView("exploration-map", FALLBACK)).toBe(FALLBACK);
  });

  it("reads back the view it was given", () => {
    writeMapView("exploration-map", ZOOMED);

    expect(readMapView("exploration-map", FALLBACK)).toEqual(ZOOMED);
  });

  // The whole point of the store: leaving a map and coming back must not
  // reset the zoom and pan.
  it("keeps each map's view independent", () => {
    writeMapView("exploration-map", ZOOMED);
    writeMapView("techno-map", { scale: 12, translateX: 5, translateY: 5 });

    expect(readMapView("exploration-map", FALLBACK)).toEqual(ZOOMED);
    expect(readMapView("techno-map", FALLBACK).scale).toBe(12);
  });

  it("does not let one map's fallback leak into another map's entry", () => {
    writeMapView("techno-map", ZOOMED);

    expect(readMapView("exploration-map", FALLBACK)).toBe(FALLBACK);
  });

  it("overwrites an earlier view for the same key", () => {
    writeMapView("exploration-map", ZOOMED);
    writeMapView("exploration-map", FALLBACK);

    expect(readMapView("exploration-map", ZOOMED)).toEqual(FALLBACK);
  });

  it("falls back once a key is cleared", () => {
    writeMapView("exploration-map", ZOOMED);
    clearMapView("exploration-map");

    expect(readMapView("exploration-map", FALLBACK)).toBe(FALLBACK);
  });

  // A hook rendered without a key must behave exactly as it did before
  // persistence existed, rather than sharing one anonymous slot.
  it("ignores a missing key on both read and write", () => {
    writeMapView(undefined, ZOOMED);

    expect(readMapView(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("ignores an empty view", () => {
    writeMapView("exploration-map", ZOOMED);
    writeMapView("exploration-map", null);

    expect(readMapView("exploration-map", FALLBACK)).toEqual(ZOOMED);
  });
});
