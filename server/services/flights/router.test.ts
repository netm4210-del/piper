import { describe, expect, it } from "vitest";
import { flightsRouter } from "./router";

describe("flight router input contract", () => {
  it("rejects a round-trip return date equal to the departure date", async () => {
    const caller = flightsRouter.createCaller({} as never);

    await expect(caller.search({
      tripType: "roundtrip",
      origin: "GRU",
      destination: "GIG",
      departureDate: "2026-12-14",
      returnDate: "2026-12-14",
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "economy",
      market: "BR",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
