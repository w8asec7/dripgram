import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { WeatherProvider } from "../providers/weather";
import { ShoppingFeedProvider, feedQueries } from "../providers/feed";
import { RequestCache, UsageMeter } from "../core";
import { MetaProvider } from "../providers/meta";
import { SerpProvider } from "../providers/serp";
import { ConfigSchema } from "../config";
import { seedGarments, makeProfile } from "../../src/mocks/seed";
import { FeedRequestSchema, uniqueProducts } from "../../shared/feed";
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});
const config = ConfigSchema.parse({
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
  SERPAPI_API_KEY: "fixture",
  MODEL_API_KEY: "",
});
test("shopping feed requests distinct query groups, caches rerenders, deduplicates and bounds pages", async () => {
  let calls = 0;
  const queries: string[] = [];
  globalThis.fetch = async (url) => {
    calls++;
    queries.push(new URL(String(url)).searchParams.get("q") || "");
    return new Response(
      JSON.stringify({
        shopping_results: [
          {
            title: "Beige pants",
            source: "Merchant",
            product_id: "same",
            price: "$25",
            link: "https://example.com/pants",
          },
          {
            title: "Beige pants",
            source: "Merchant",
            product_id: "same",
            price: "$25",
            link: "https://example.com/pants",
          },
        ],
      }),
    );
  };
  const cache = new RequestCache(),
    usage = new UsageMeter();
  const feed = new ShoppingFeedProvider(
    cache,
    new MetaProvider(config, cache, usage),
    new SerpProvider(config, cache, usage),
  );
  const profile = makeProfile("demo", "Demo");
  const input = FeedRequestSchema.parse({ mode: "discover" });
  const first = await feed.page("demo", input, seedGarments, profile);
  assert.equal(first.products.length, 1);
  assert.equal(first.nextPage, 1);
  await feed.page("demo", input, seedGarments, profile);
  assert.equal(calls, 1);
  const second = await feed.page(
    "demo",
    { ...input, page: 1 },
    seedGarments,
    profile,
  );
  assert.notEqual(queries[0], queries[1]);
  assert.equal(calls, 4);
  assert.equal(
    uniqueProducts([...first.products, ...second.products]).length,
    1,
  );
  assert.equal(
    FeedRequestSchema.safeParse({ ...input, page: 24 }).success,
    false,
  );
  const rotated = await feed.page(
    "demo",
    { ...input, rotation: 1 },
    seedGarments,
    profile,
  );
  assert.notEqual(rotated.query, first.query);
  assert.equal(
    calls,
    4,
    "Refreshing rotates into already cached distinct queries without spending duplicate requests",
  );
  const plan = feedQueries(seedGarments, profile, "complete");
  assert.ok(plan.length >= 4);
  assert.equal(new Set(plan.map((p) => p.query)).size, plan.length);
});
test("weather uses a city only, validates data and caches independent displays", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    const u = new URL(String(url));
    assert.equal(u.hostname, "api.open-meteo.com");
    assert.equal(u.searchParams.get("temperature_unit"), "fahrenheit");
    return new Response(
      JSON.stringify({
        current: {
          time: Math.floor(Date.now() / 1000),
          temperature_2m: 82,
          precipitation: 0,
          weather_code: 3,
        },
      }),
    );
  };
  const weather = new WeatherProvider(new RequestCache());
  const city = {
    name: "Austin",
    latitude: 30.27,
    longitude: -97.74,
    timezone: "America/Chicago",
  };
  const first = await weather.current(city);
  assert.equal(first.temperatureF, 82);
  assert.equal(first.source, "Open-Meteo");
  await weather.current(city);
  assert.equal(calls, 1);
});

test("normalized repeated search/filter changes reuse raw results without losing higher-priced listings", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        shopping_results: [
          {
            title: "Plain T-shirt",
            source: "Fixture",
            product_id: "cheap",
            price: "$20",
            link: "https://example.test/cheap",
          },
          {
            title: "Premium T-shirt",
            source: "Fixture",
            product_id: "expensive",
            price: "$80",
            link: "https://example.test/expensive",
          },
        ],
      }),
    );
  };
  const provider = new SerpProvider(
    config,
    new RequestCache(),
    new UsageMeter(),
  );
  const filtered = await provider.search({
    query: "  Plain   T-Shirt  ",
    maxPrice: 30,
  });
  assert.equal(filtered.products.length, 1);
  const all = await provider.search({ query: "plain t-shirt" });
  assert.equal(all.products.length, 2);
  assert.equal(calls, 1);
  const sale = await provider.search({ query: "plain t-shirt", onSale: true });
  assert.equal(sale.products.length, 0);
  assert.equal(calls, 1);
  assert.equal(filtered.checkedAt, all.checkedAt);
});
