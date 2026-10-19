import { describe, expect, it } from "vitest";
import * as drillState from "../../../src/pages/DrillMap/mapDataState.js";
import * as technoState from "../../../src/pages/TechnoMap/mapDataState.js";

const copies = [
  ["DrillMap", drillState],
  ["TechnoMap", technoState],
];

describe.each(copies)("%s/mapDataState", (_name, mod) => {
  const { LOADING_STATE, projectRecords, resolveLoadedState, resolveFailedState } = mod;

  const project = (record) => (record.valid ? { ...record, xPercent: 1, yPercent: 2 } : null);

  it("exposes a frozen loading state", () => {
    expect(LOADING_STATE).toMatchObject({ status: "loading", drillholes: [], message: "" });
    expect(Object.isFrozen(LOADING_STATE)).toBe(true);
  });

  describe("projectRecords", () => {
    it("drops records the projection rejects", () => {
      const result = projectRecords([{ valid: true }, { valid: false }], project);

      expect(result).toHaveLength(1);
    });

    it("returns an empty array for no records", () => {
      expect(projectRecords([], project)).toEqual([]);
    });

    it("keeps every record when all project cleanly", () => {
      expect(projectRecords([{ valid: true }, { valid: true }], project)).toHaveLength(2);
    });
  });

  describe("resolveLoadedState", () => {
    it("reports 'empty' when the API returned nothing", () => {
      expect(resolveLoadedState([], project)).toEqual({
        status: "empty",
        drillholes: [],
        message: "",
      });
    });

    it("reports 'ready' with the projected drillholes", () => {
      const state = resolveLoadedState([{ valid: true }], project);

      expect(state.status).toBe("ready");
      expect(state.drillholes).toHaveLength(1);
      expect(state.message).toBe("");
    });

    it("reports 'error' when records exist but none have usable coordinates", () => {
      // Distinct from 'empty': the API had data, we just cannot plot it.
      const state = resolveLoadedState([{ valid: false }, { valid: false }], project);

      expect(state.status).toBe("error");
      expect(state.drillholes).toEqual([]);
      expect(state.message).toMatch(/UTM coordinates/);
    });

    it("keeps the partially usable records when only some project", () => {
      const state = resolveLoadedState([{ valid: true }, { valid: false }], project);

      expect(state.status).toBe("ready");
      expect(state.drillholes).toHaveLength(1);
    });
  });

  describe("resolveFailedState", () => {
    it("surfaces the error message", () => {
      const state = resolveFailedState(new Error("Database offline"));

      expect(state).toEqual({ status: "error", drillholes: [], message: "Database offline" });
    });

    it("falls back to a default message when the error has none", () => {
      const state = resolveFailedState(new Error(""));

      expect(state.status).toBe("error");
      expect(state.message).toMatch(/Unable to load/);
    });
  });
});
