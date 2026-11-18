export const analyticsConfig = {
  enabled: Boolean(process.env.ANALYTICS_ID),
  measurementId: process.env.ANALYTICS_ID ?? "",
  events: [
    "page_view",
    "search_flight",
    "search_hotel",
    "select_destination",
    "view_flight_results",
    "view_hotel_results",
    "click_buy_flight",
    "click_book_hotel",
    "begin_checkout",
    "purchase",
    "whatsapp_click",
  ] as const,
} as const;
