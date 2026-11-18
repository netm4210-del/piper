import { afterEach, describe, expect, it } from "vitest";
import { getIntegrationStatus } from "./integrationStatus";

const previousKey = process.env.SERPAPI_API_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = previousKey;
});

describe("integration availability status", () => {
  it("reflects runtime SerpApi key availability for flights and hotels", () => {
    delete process.env.SERPAPI_API_KEY;
    expect(getIntegrationStatus().flights.enabled).toBe(false);
    expect(getIntegrationStatus().hotels.enabled).toBe(false);

    process.env.SERPAPI_API_KEY = "test-key-only";
    const status = getIntegrationStatus();
    expect(status.flights.enabled).toBe(true);
    expect(status.hotels.enabled).toBe(true);
    expect(JSON.stringify(status)).not.toContain("test-key-only");
  });
});
