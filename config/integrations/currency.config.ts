export const supportedCurrencies = ["BRL", "USD", "EUR", "GBP", "CLP", "ARS", "AUD", "CAD", "JPY"] as const;

export const currencyIntegrationConfig = {
  enabled: Boolean(process.env.CURRENCY_API_KEY),
  baseCurrency: "BRL",
  showOriginalCurrency: true,
} as const;
