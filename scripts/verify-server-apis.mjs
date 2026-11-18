import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { readFile, writeFile } from 'node:fs/promises';

// This script calls the application server, never a provider with a browser key.
// Run deliberately: real provider requests can consume the owner's SerpApi quota.
const origin = process.argv[2] || 'http://127.0.0.1:3000';
const output = process.argv[3] || '/tmp/piper-api-verification.json';
const resume = process.argv.includes('--resume-after-server-restart');
const previous = resume ? JSON.parse(await readFile(output, 'utf8')) : undefined;
const client = createTRPCUntypedClient({
  links: [httpBatchLink({ url: `${origin}/api/trpc`, transformer: superjson })],
});
const dateAfter = days => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const departureDate = dateAfter(45);
const returnDate = dateAfter(49);
const flightInput = {
  tripType: 'oneway', origin: 'GRU', destination: 'GIG', departureDate,
  adults: 1, children: 0, infants: 0, cabin: 'economy', market: 'BR',
};
const results = [];
let stopReason;
let flightOffers;

async function check(label, operation, summarize) {
  const prior = previous?.results.find(item => item.label === label && item.status === 'ok');
  if (prior && ['airport autocomplete', 'price calendar GRU-GIG'].includes(label)) {
    results.push({ ...prior, preservedFrom: previous.checkedAt });
    console.log(`${label}: previously verified; no additional provider request`);
    return;
  }
  if (stopReason) {
    results.push({ label, status: 'not_tested', reason: stopReason });
    return;
  }
  const started = Date.now();
  try {
    const data = await operation();
    const summary = summarize(data);
    results.push({ label, status: 'ok', durationMs: Date.now() - started, ...summary });
    console.log(`${label}: OK (${summary.count ?? 'status'} result(s))`);
    return data;
  } catch (error) {
    const code = error?.data?.code || 'REQUEST_FAILED';
    const message = String(error?.message || 'Falha de requisição').slice(0, 300);
    results.push({ label, status: 'error', durationMs: Date.now() - started, code, message });
    console.log(`${label}: ERROR ${code}: ${message}`);
    if (['UNAUTHORIZED', 'FORBIDDEN', 'TOO_MANY_REQUESTS', 'PRECONDITION_FAILED', 'SERVICE_UNAVAILABLE', 'REQUEST_FAILED'].includes(code)) {
      stopReason = `Stopped after ${label}: ${code}; no retries or extra provider queries.`;
    }
  }
}
const priceSummary = entries => ({
  count: entries.length,
  currencies: [...new Set(entries.map(item => item.price?.currency || item.currency).filter(Boolean))],
});

await check('health', async () => {
  const response = await fetch(`${origin}/api/health`);
  if (!response.ok) throw new Error(`Health HTTP ${response.status}`);
  return response.json();
}, data => ({ serverStatus: data.status }));
await check('integration configuration', () => client.query('integrations.status'), data => ({
  flightsConfigured: data.flights.enabled,
  hotelsConfigured: data.hotels.enabled,
  checkoutEnabled: data.checkout.enabled,
  currencyConversionEnabled: data.currency.enabled,
  externalAnalyticsEnabled: data.analytics.enabled,
}));
await check('airport autocomplete', () => client.query('flights.airports', {
  query: 'São Paulo', limit: 8, market: 'BR',
}), data => ({ count: data.length, airportCodes: data.map(item => item.code) }));
flightOffers = await check('one-way flights GRU-GIG', () => client.mutation('flights.search', flightInput), data => ({
  ...priceSummary(data), carriers: [...new Set(data.map(item => item.airline.name))],
  bookingTokenCount: data.filter(item => item.bookingToken).length,
  sampleAmount: data[0]?.price.amount,
}));
await check('price calendar GRU-GIG', () => client.mutation('flights.calendar', {
  ...flightInput, returnDate,
}), data => priceSummary(data));
await check('flight deals from GRU', () => client.mutation('flights.deals', {
  origin: 'GRU', market: 'BR',
}), data => priceSummary(data));
await check('Airbnb Rio de Janeiro', () => client.mutation('hotels.search', {
  location: 'Rio de Janeiro', checkIn: departureDate, checkOut: returnDate,
  adults: 2, children: 0, infants: 0,
}), data => ({
  count: data.listings.length, currency: data.currency,
  genuineHttpsLinks: data.listings.every(item => item.link.startsWith('https://')),
  photosCount: data.listings.filter(item => item.thumbnail).length,
}));
await check('round-trip flights GRU-GIG', () => client.mutation('flights.search', {
  ...flightInput, tripType: 'roundtrip', returnDate,
}), data => ({ ...priceSummary(data), inboundCount: data.filter(item => item.inbound).length }));
if (flightOffers?.some(item => item.bookingToken)) {
  const offer = flightOffers.find(item => item.bookingToken);
  await check('booking options from returned flight token', () => client.mutation('flights.bookingLinks', {
    ...flightInput, bookingToken: offer.bookingToken,
  }), data => ({
    ...priceSummary(data), linkCount: data.filter(item => item.url?.startsWith('https://')).length,
  }));
}
const report = {
  checkedAt: new Date().toISOString(), origin, departureDate, returnDate,
  policy: 'Real HTTP/backend requests, no fixtures, no automatic retries, no reservations or payments. Counts reflect the actual response at this time.',
  ...(resume ? { previousAttemptCheckedAt: previous.checkedAt, recoveryReason: 'Development server hot reload interrupted the first HTTP attempt; preserved successful autocomplete/calendar checks. A new flight lookup is needed for an in-memory booking token.' } : {}),
  results,
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Summary saved to ${output}`);
if (results.some(item => item.status !== 'ok')) process.exitCode = 1;
