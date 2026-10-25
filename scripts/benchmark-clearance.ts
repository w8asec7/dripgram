/** Controlled latency comparison. Synthetic provider fixtures; spends no credits. */
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { ShoppingFeedProvider, feedQueries } from "../server/providers/feed";
import { MetaProvider } from "../server/providers/meta";
import { SerpProvider } from "../server/providers/serp";
import { ConfigSchema } from "../server/config";
import { RequestCache, UsageMeter } from "../server/core";
import { makeProfile } from "../src/mocks/seed";
import { FeedRequestSchema } from "../shared/feed";
async function main() {
  const realFetch = globalThis.fetch;
  const config = ConfigSchema.parse({
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
    SERPAPI_API_KEY: "synthetic",
  });
  const profile = makeProfile("latency-fixture", "Fixture");
  let calls = 0;
  globalThis.fetch = async () => {
    const position = calls++;
    await new Promise((resolve) =>
      setTimeout(resolve, [30, 140, 220][position % 3]),
    );
    return new Response(
      JSON.stringify({
        shopping_results: [
          {
            title: "Beige pants",
            source: "Fixture Store",
            product_id: `fixture-${position}`,
            price: "$20",
            old_price: "$40",
            link: `https://example.test/${position}`,
          },
        ],
      }),
    );
  };
  try {
    const oldCache = new RequestCache(),
      oldUsage = new UsageMeter(),
      oldSerp = new SerpProvider(config, oldCache, oldUsage);
    const beforeStart = performance.now();
    // The pre-change Clearance barrier: all three independent queries must finish.
    await Promise.all(
      feedQueries([], profile, "clearance")
        .slice(0, 3)
        .map((q) =>
          oldSerp.search({ query: `${q.query} sale clearance`, onSale: true }),
        ),
    );
    const beforeMs = performance.now() - beforeStart;
    calls = 0;
    const cache = new RequestCache(),
      usage = new UsageMeter();
    const provider = new ShoppingFeedProvider(
      cache,
      new MetaProvider(config, cache, usage),
      new SerpProvider(config, cache, usage),
    );
    const afterStart = performance.now();
    const result = await provider.page(
      "latency-fixture",
      FeedRequestSchema.parse({ mode: "clearance" }),
      [],
      profile,
    );
    const afterMs = performance.now() - afterStart;
    const report = {
      source:
        "controlled synthetic provider latency; not a live before/after benchmark",
      providerDelaysMs: [30, 140, 220],
      beforeFirstBatchMs: Math.round(beforeMs),
      afterFirstBatchMs: Math.round(afterMs),
      beforeSearchesRequired: 3,
      afterSearchesRequired: calls,
      verifiedSaleResults: result.products.length,
      liveCalls: 0,
    };
    await writeFile(
      "docs/clearance-performance.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.info(JSON.stringify(report));
  } finally {
    globalThis.fetch = realFetch;
  }
}
main().catch(() => {
  console.error("Controlled Clearance benchmark failed.");
  process.exitCode = 1;
});
