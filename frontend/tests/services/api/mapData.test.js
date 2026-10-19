import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDrillholeMap, fetchTechnoMap } from "../../../src/services/api/mapData.js";

const jsonResponse = (body, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
});

const endpoints = [
  ["fetchDrillholeMap", fetchDrillholeMap, "/api/exploration-map", /drillhole/i],
  ["fetchTechnoMap", fetchTechnoMap, "/api/techno-map", /TechnoMap/i],
];

describe.each(endpoints)("%s", (_name, fetchRecords, path, subject) => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the expected endpoint path", async () => {
    fetch.mockResolvedValue(jsonResponse([]));

    await fetchRecords();

    expect(fetch.mock.calls[0][0]).toContain(path);
  });

  it("returns the record array on success", async () => {
    const records = [{ holeId: "GTZO-1", x: 418000, y: 4894000 }];
    fetch.mockResolvedValue(jsonResponse(records));

    await expect(fetchRecords()).resolves.toEqual(records);
  });

  it("returns an empty array unchanged", async () => {
    fetch.mockResolvedValue(jsonResponse([]));

    await expect(fetchRecords()).resolves.toEqual([]);
  });

  it("throws the server-supplied message on an error status", async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: "Database offline" }, false));

    await expect(fetchRecords()).rejects.toThrow("Database offline");
  });

  it("throws a default message when the error body is empty", async () => {
    fetch.mockResolvedValue(jsonResponse("", false));

    await expect(fetchRecords()).rejects.toThrow(subject);
  });

  it("rejects a non-array success body", async () => {
    // A single object here would otherwise reach .map() downstream and crash.
    fetch.mockResolvedValue(jsonResponse({ holeId: "GTZO-1" }));

    await expect(fetchRecords()).rejects.toThrow(/JSON array/);
  });

  it("rejects an HTML body from a misconfigured proxy", async () => {
    fetch.mockResolvedValue(jsonResponse("<html>Bad Gateway</html>"));

    await expect(fetchRecords()).rejects.toThrow(/JSON array/);
  });

  it("surfaces a connection failure with a friendly message", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchRecords()).rejects.toThrow(/Unable to connect/);
  });

  it("propagates an abort so the caller can ignore it", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    fetch.mockRejectedValue(abortError);

    await expect(fetchRecords()).rejects.toMatchObject({ name: "AbortError" });
  });

  // The kind decides the toast, so each failure must be told apart.
  it("reports an error status as an http ApiError with the status", async () => {
    fetch.mockResolvedValue(jsonResponse("Microsoft.Data.SqlClient.SqlException ...", false, 500));

    await expect(fetchRecords()).rejects.toMatchObject({ name: "ApiError", kind: "http", status: 500 });
  });

  it("reports a non-array body as an invalid-response ApiError", async () => {
    fetch.mockResolvedValue(jsonResponse({ holeId: "GTZO-1" }));

    await expect(fetchRecords()).rejects.toMatchObject({ name: "ApiError", kind: "invalid-response" });
  });

  it("reports a refused connection as a network ApiError", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchRecords()).rejects.toMatchObject({ name: "ApiError", kind: "network" });
  });

  it("applies the configured request timeout", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));

    try {
      const outcome = expect(fetchRecords()).rejects.toMatchObject({ kind: "timeout" });
      await vi.advanceTimersByTimeAsync(60000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});
