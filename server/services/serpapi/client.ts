const SERPAPI_SEARCH_ENDPOINT = "https://serpapi.com/search.json";

export class SerpApiNotConfiguredError extends Error {
  constructor() {
    super("A variável segura SERPAPI_API_KEY não está configurada no servidor.");
    this.name = "SerpApiNotConfiguredError";
  }
}

export class SerpApiTimeoutError extends Error {
  constructor() {
    super("A SerpApi demorou mais que o esperado. Tente novamente.");
    this.name = "SerpApiTimeoutError";
  }
}

export class SerpApiRequestError extends Error {
  constructor(readonly status: number) {
    super(status === 429
      ? "O limite de pesquisas da SerpApi foi atingido. Aguarde e tente novamente."
      : status === 401 || status === 403
        ? "A chave SerpApi foi recusada ou não tem acesso a este engine."
        : status >= 500
          ? "A fonte SerpApi está temporariamente indisponível."
          : "A SerpApi não aceitou os critérios desta pesquisa.");
    this.name = "SerpApiRequestError";
  }
}

export function getSerpApiKey(): string {
  const configured = process.env.SERPAPI_API_KEY?.trim();
  if (configured) return configured;
  throw new SerpApiNotConfiguredError();
}

export function isSerpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

export function sourceTimestamp(payload: Record<string, unknown>): string {
  const metadata = isRecord(payload.search_metadata) ? payload.search_metadata : undefined;
  const candidate = metadata?.processed_at ?? metadata?.created_at;
  if (typeof candidate === "string" && Number.isFinite(Date.parse(candidate))) return new Date(candidate).toISOString();
  return new Date().toISOString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readCurrency(payload: Record<string, unknown>): string | undefined {
  if (!isRecord(payload.search_parameters)) return undefined;
  const currency = payload.search_parameters.currency;
  return typeof currency === "string" ? currency.toUpperCase() : undefined;
}

export async function requestSerpApi(params: URLSearchParams, timeoutMs = 20_000): Promise<Record<string, unknown>> {
  const key = getSerpApiKey();
  const url = new URL(SERPAPI_SEARCH_ENDPOINT);
  for (const [name, value] of params) url.searchParams.set(name, value);
  url.searchParams.set("output", "json");
  url.searchParams.set("api_key", key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new SerpApiTimeoutError();
      }
      throw new SerpApiRequestError(503);
    }

    let payload: Record<string, unknown>;
    try {
      const json: unknown = await response.json();
      if (!isRecord(json)) throw new Error("Invalid JSON object");
      payload = json;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new SerpApiTimeoutError();
      }
      throw new SerpApiRequestError(response.status >= 400 ? response.status : 502);
    }

    const metadata = isRecord(payload.search_metadata) ? payload.search_metadata : undefined;
    const failed = !response.ok || Boolean(payload.error) || metadata?.status === "Error";
    if (failed) throw new SerpApiRequestError(response.status >= 400 ? response.status : 502);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
