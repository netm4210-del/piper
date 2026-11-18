import { afterEach, describe, expect, it, vi } from "vitest";
import { requestSerpApi, SerpApiTimeoutError } from "./client";

afterEach(() => {
  delete process.env.SERPAPI_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestSerpApi", () => {
  it("keeps its timeout active while the response body is being read", async () => {
    process.env.SERPAPI_API_KEY = "test-key-only";
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestSerpApi(new URLSearchParams({ engine: "airbnb" }), 20))
      .rejects.toBeInstanceOf(SerpApiTimeoutError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
