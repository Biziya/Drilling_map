import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getErrorMessage, readBody, requestJson } from "../../../src/services/Api/apiResponse.js";

describe("getErrorMessage", () => {
  it("uses a plain string body", () => {
    expect(getErrorMessage("Something broke", "fallback")).toBe("Something broke");
  });

  it("ignores a whitespace-only string body", () => {
    expect(getErrorMessage("   ", "fallback")).toBe("fallback");
  });

  it("prefers ProblemDetails.detail", () => {
    expect(getErrorMessage({ detail: "d", message: "m", title: "t" }, "fallback")).toBe("d");
  });

  it("falls back through message then title", () => {
    expect(getErrorMessage({ message: "m", title: "t" }, "fallback")).toBe("m");
    expect(getErrorMessage({ title: "t" }, "fallback")).toBe("t");
  });

  it("uses the fallback for an unrecognised object", () => {
    expect(getErrorMessage({ code: 500 }, "fallback")).toBe("fallback");
  });

  it("uses the fallback for null and undefined bodies", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});

describe("readBody", () => {
  const responseWith = (text) => ({ text: () => Promise.resolve(text) });

  it("parses a JSON array", async () => {
    await expect(readBody(responseWith('[{"a":1}]'))).resolves.toEqual([{ a: 1 }]);
  });

  it("parses a JSON object", async () => {
    await expect(readBody(responseWith('{"detail":"nope"}'))).resolves.toEqual({ detail: "nope" });
  });

  it("returns null for an empty body", async () => {
    await expect(readBody(responseWith(""))).resolves.toBeNull();
  });

  it("returns the raw text when the body is not JSON", async () => {
    // An HTML error page from a proxy must not blow up the parser.
    await expect(readBody(responseWith("<html>502</html>"))).resolves.toBe("<html>502</html>");
  });
});

describe("requestJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("issues a GET that accepts JSON", async () => {
    const response = { ok: true };
    fetch.mockResolvedValue(response);

    const result = await requestJson("https://example.test/api/x", {
      connectionErrorMessage: "no connection",
    });

    expect(result).toBe(response);
    expect(fetch).toHaveBeenCalledWith("https://example.test/api/x", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: undefined,
    });
  });

  it("passes the abort signal through", async () => {
    fetch.mockResolvedValue({ ok: true });
    const controller = new AbortController();

    await requestJson("https://example.test/api/x", {
      signal: controller.signal,
      connectionErrorMessage: "no connection",
    });

    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("returns non-ok responses rather than throwing", async () => {
    // Status handling belongs to the caller, which needs the body for its message.
    const response = { ok: false, status: 500 };
    fetch.mockResolvedValue(response);

    await expect(requestJson("https://example.test/api/x", { connectionErrorMessage: "x" }))
      .resolves.toBe(response);
  });

  it("wraps a network failure in a friendly error and keeps the cause", async () => {
    const networkError = new TypeError("Failed to fetch");
    fetch.mockRejectedValue(networkError);

    await expect(
      requestJson("https://example.test/api/x", { connectionErrorMessage: "Cannot reach API." }),
    ).rejects.toThrow("Cannot reach API.");

    await expect(
      requestJson("https://example.test/api/x", { connectionErrorMessage: "Cannot reach API." }),
    ).rejects.toMatchObject({ cause: networkError });
  });

  it("rethrows an abort untouched so callers can ignore it", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    fetch.mockRejectedValue(abortError);

    await expect(requestJson("https://example.test/api/x", { connectionErrorMessage: "x" }))
      .rejects.toBe(abortError);
  });
});
