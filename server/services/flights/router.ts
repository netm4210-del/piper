import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../../_core/trpc";
import {
  SerpApiFlightProvider,
  type FlightCalendarInput,
  type FlightDealsInput,
} from "./serpapi";
import {
  SerpApiNotConfiguredError,
  SerpApiRequestError,
  SerpApiTimeoutError,
} from "../serpapi/client";

const flightProvider = new SerpApiFlightProvider();
const cabinSchema = z.enum(["economy", "premium_economy", "business", "first"]);
const marketSchema = z.string().regex(/^[A-Za-z]{2}$/).default("BR");
const passengerFields = {
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(8),
  infants: z.number().int().min(0).max(8),
  cabin: cabinSchema,
  market: marketSchema,
};

const baseInput = z.object({
  tripType: z.enum(["oneway", "roundtrip", "multi"]),
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use o código IATA de 3 letras na origem."),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use o código IATA de 3 letras no destino."),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional(),
  segments: z.array(z.object({
    origin: z.string().trim().regex(/^[A-Za-z]{3}$/),
    destination: z.string().trim().regex(/^[A-Za-z]{3}$/),
    departureDate: z.string().date(),
  })).max(2).optional(),
  adults: passengerFields.adults,
  children: passengerFields.children,
  infants: passengerFields.infants,
  cabin: cabinSchema,
  market: marketSchema,
}).superRefine((value, ctx) => {
  if (value.adults + value.children + value.infants > 9) {
    ctx.addIssue({ code: "custom", path: ["adults"], message: "A PIPER permite até 9 passageiros por pesquisa." });
  }
  if (value.infants > value.adults) {
    ctx.addIssue({ code: "custom", path: ["infants"], message: "A quantidade de bebês no colo não pode exceder a de adultos." });
  }
  if (value.tripType === "roundtrip" && !value.returnDate) {
    ctx.addIssue({ code: "custom", path: ["returnDate"], message: "Informe a data de volta para uma ida e volta." });
  }
  if (value.returnDate && value.returnDate <= value.departureDate) {
    ctx.addIssue({ code: "custom", path: ["returnDate"], message: "A volta precisa acontecer depois da ida." });
  }
  if (value.tripType === "multi") {
    if (!value.segments || value.segments.length < 1 || value.segments.length > 2) {
      ctx.addIssue({ code: "custom", path: ["segments"], message: "Informe um ou dois trechos para a viagem multi-cidade." });
    } else {
      for (let index = 1; index < value.segments.length; index += 1) {
        if (value.segments[index - 1].destination.toUpperCase() !== value.segments[index].origin.toUpperCase()) {
          ctx.addIssue({ code: "custom", path: ["segments", index, "origin"], message: "A origem de cada trecho deve ser o destino do trecho anterior." });
        }
        if (value.segments[index].departureDate < value.segments[index - 1].departureDate) {
          ctx.addIssue({ code: "custom", path: ["segments", index, "departureDate"], message: "As datas dos trechos precisam estar em ordem." });
        }
      }
      if (value.departureDate !== value.segments[0].departureDate) {
        ctx.addIssue({ code: "custom", path: ["departureDate"], message: "A data inicial deve corresponder ao primeiro trecho." });
      }
    }
  }
});

const calendarInput = z.object({
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/),
  tripType: z.enum(["oneway", "roundtrip"]),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional(),
  adults: passengerFields.adults,
  children: passengerFields.children,
  infants: passengerFields.infants,
  cabin: cabinSchema,
  market: marketSchema,
}).superRefine((value, ctx) => {
  if (value.adults + value.children + value.infants > 9) ctx.addIssue({ code: "custom", path: ["adults"], message: "A PIPER permite até 9 passageiros por pesquisa." });
  if (value.infants > value.adults) ctx.addIssue({ code: "custom", path: ["infants"], message: "A quantidade de bebês no colo não pode exceder a de adultos." });
  if (value.tripType === "roundtrip" && value.returnDate && value.returnDate <= value.departureDate) {
    ctx.addIssue({ code: "custom", path: ["returnDate"], message: "A volta precisa acontecer depois da ida." });
  }
});

const dealsInput = z.object({ origin: z.string().trim().regex(/^[A-Za-z]{3}$/), market: marketSchema });
const bookingInput = baseInput.and(z.object({ bookingToken: z.string().trim().min(1).max(30_000) }));

const limiters = new Map<string, { count: number; resetAt: number }>();
function enforceRateLimit(ip: string, bucket: string, maximum: number) {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const current = limiters.get(key);
  if (!current || current.resetAt <= now) {
    limiters.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= maximum) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente." });
  }
  current.count += 1;
  if (limiters.size > 10_000) {
    for (const [entryKey, entry] of limiters) if (entry.resetAt <= now) limiters.delete(entryKey);
  }
}

function requestIp(ctx: { req: { ip?: string; headers: Record<string, unknown> } }): string {
  const forwarded = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
  return ctx.req.ip || forwarded || "unknown";
}

function toClientError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof SerpApiNotConfiguredError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A chave SerpApi não está configurada no servidor." });
  }
  if (error instanceof SerpApiTimeoutError) {
    throw new TRPCError({ code: "TIMEOUT", message: error.message });
  }
  if (error instanceof SerpApiRequestError) {
    const code = error.status === 429
      ? "TOO_MANY_REQUESTS"
      : error.status === 401 || error.status === 403
        ? "UNAUTHORIZED"
        : error.status >= 500
          ? "SERVICE_UNAVAILABLE"
          : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir a pesquisa de voos agora." });
}

export const flightsRouter = router({
  airports: publicProcedure.input(z.object({
    query: z.string().trim().min(2).max(120),
    limit: z.number().int().min(1).max(20).default(8),
    market: marketSchema,
  })).query(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx), "airports", 40);
    try {
      return await flightProvider.searchAirports(input.query, input.limit, input.market);
    } catch (error) {
      return toClientError(error);
    }
  }),
  search: publicProcedure.input(baseInput).mutation(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx), "search", 12);
    try {
      return await flightProvider.search(input);
    } catch (error) {
      return toClientError(error);
    }
  }),
  calendar: publicProcedure.input(calendarInput).mutation(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx), "calendar", 8);
    try {
      return await flightProvider.calendar(input as FlightCalendarInput);
    } catch (error) {
      return toClientError(error);
    }
  }),
  deals: publicProcedure.input(dealsInput).mutation(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx), "deals", 8);
    try {
      return await flightProvider.deals(input as FlightDealsInput);
    } catch (error) {
      return toClientError(error);
    }
  }),
  bookingLinks: publicProcedure.input(bookingInput).mutation(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx), "booking", 12);
    try {
      return await flightProvider.bookingOptions(input.bookingToken, input);
    } catch (error) {
      return toClientError(error);
    }
  }),
});
