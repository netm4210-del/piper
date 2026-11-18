import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../../_core/trpc";
import { airbnbSerpApiProvider } from "./airbnb-serpapi";
import {
  SerpApiNotConfiguredError,
  SerpApiRequestError,
  SerpApiTimeoutError,
} from "../serpapi/client";

const searchInput = z.object({
  location: z.string().trim().min(2).max(120),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
  infants: z.number().int().min(0).max(20).default(0),
  propertyTypes: z.array(z.enum(["house", "apartment", "guesthouse", "hotel"])).max(4).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
}).superRefine((value, ctx) => {
  if (value.checkOut <= value.checkIn) {
    ctx.addIssue({ code: "custom", path: ["checkOut"], message: "O check-out precisa acontecer depois do check-in." });
  }
  if (value.adults + value.children + value.infants > 20) {
    ctx.addIssue({ code: "custom", path: ["adults"], message: "A PIPER permite até 20 hóspedes por pesquisa." });
  }
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.maxPrice < value.minPrice) {
    ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "O preço máximo precisa ser maior que o mínimo." });
  }
});

const limiter = new Map<string, { count: number; resetAt: number }>();
function enforceRateLimit(ip: string) {
  const now = Date.now();
  const current = limiter.get(ip);
  if (!current || current.resetAt <= now) {
    limiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 6) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas pesquisas de hospedagem em pouco tempo. Aguarde um minuto e tente novamente." });
  }
  current.count += 1;
}

function requestIp(ctx: { req: { ip?: string; headers: Record<string, unknown> } }): string {
  const forwarded = ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
  return ctx.req.ip || forwarded || "unknown";
}

function mapError(error: unknown): never {
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
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir a pesquisa de hospedagem agora." });
}

export const hotelsRouter = router({
  search: publicProcedure.input(searchInput).mutation(async ({ input, ctx }) => {
    enforceRateLimit(requestIp(ctx));
    try {
      return await airbnbSerpApiProvider.search(input);
    } catch (error) {
      return mapError(error);
    }
  }),
});
