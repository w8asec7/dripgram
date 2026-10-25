import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { MetaProvider, MetaDiagnostic } from "../providers/meta";
import { prepareImage } from "../providers/images";
import { ConfigSchema } from "../config";
import { RequestCache, UsageMeter, providerFetch, ApiError } from "../core";
import { ShoppingFeedProvider } from "../providers/feed";
import { SerpProvider, buildShoppingQuery } from "../providers/serp";
import { makeProfile, seedGarments } from "../../src/mocks/seed";
import { FeedRequestSchema } from "../../shared/feed";
import { GarmentAnalysisSchema } from "../../src/services/ai";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const config = ConfigSchema.parse({
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
  MODEL_API_KEY: "fixture-private",
  SERPAPI_API_KEY: "fixture-private",
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const core = {
  category: "t-shirt",
  primaryColor: "red",
  fit: "unknown",
  pattern: "solid",
  garmentRegion: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
};
test("empty token-limited vision response accounts usage and recovers once with compact schema, same model and cap", async () => {
  const { inference } = await prepareImage({
    base64: (await readFile("tests/fixtures/red-shirt.jpg")).toString("base64"),
    mimeType: "image/jpeg",
  });
  let calls = 0;
  const diagnostics: MetaDiagnostic[] = [];
  globalThis.fetch = async (_url, options) => {
    calls++;
    const request = JSON.parse(String(options?.body));
    assert.equal(request.model, "muse-spark-1.2");
    assert.equal(request.reasoning_effort, "minimal");
    assert.equal(request.max_completion_tokens, 2400);
    assert.equal(request.messages.length, 2);
    const content = request.messages[1].content;
    assert.equal(content[0].type, "text");
    assert.ok(content[0].text.length < 800);
    assert.ok(!content[0].text.includes("base64"));
    assert.equal(content[1].type, "image_url");
    assert.equal(
      content[1].image_url.url,
      `data:image/jpeg;base64,${inference.toString("base64")}`,
    );
    return calls === 1
      ? json({
          choices: [{ message: { content: null }, finish_reason: "length" }],
          usage: {
            prompt_tokens: 101,
            completion_tokens: 2400,
            completion_tokens_details: { reasoning_tokens: 2400 },
          },
        })
      : json({
          choices: [
            {
              message: { content: JSON.stringify(core) },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 70, completion_tokens: 200 },
        });
  };
  const usage = new UsageMeter(),
    provider = new MetaProvider(config, new RequestCache(), usage, (d) =>
      diagnostics.push(d),
    );
  const result = await provider.analyze(
    "alice",
    `data:image/jpeg;base64,${inference.toString("base64")}`,
  );
  assert.equal(GarmentAnalysisSchema.parse(result).primaryColor, "red");
  assert.equal(
    result.confidence,
    null,
    "No confidence is fabricated by deterministic enrichment",
  );
  assert.equal(calls, 2);
  assert.equal(usage.snapshot().outputTokens, 2600);
  assert.equal(diagnostics[0].reasoningTokens, 2400);
  assert.equal(diagnostics[0].errorCode, "MODEL_TOKEN_LIMIT");
  assert.ok(diagnostics[1].schemaCharacters < diagnostics[0].schemaCharacters);
  const safe = JSON.stringify(diagnostics);
  assert.ok(
    !safe.includes("fixture-private") &&
      !safe.includes("base64") &&
      !safe.includes("alice"),
  );
});
test("real context and payload errors are distinct, sanitized and never retried as output truncation", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json(
      {
        error: {
          code: "context_length_exceeded",
          message: "maximum context: secret-personal-image",
        },
      },
      400,
    );
  };
  const provider = new MetaProvider(
    config,
    new RequestCache(),
    new UsageMeter(),
    () => undefined,
  );
  await assert.rejects(
    provider.analyze("alice", "fixture"),
    (e: unknown) =>
      e instanceof ApiError &&
      e.code === "MODEL_CONTEXT_LIMIT" &&
      !e.message.includes("secret-personal"),
  );
  assert.equal(calls, 1);
  globalThis.fetch = async () => json({ error: "private" }, 413);
  await assert.rejects(
    providerFetch("https://fixture.example"),
    (e: unknown) => e instanceof ApiError && e.code === "IMAGE_PAYLOAD_LIMIT",
  );
});
test("high-resolution image is orientation-normalized and bounded before inference", async () => {
  const image = await sharp({
    create: { width: 3024, height: 4032, channels: 3, background: "red" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const prepared = await prepareImage({
    base64: image.toString("base64"),
    mimeType: "image/jpeg",
  });
  const metadata = await sharp(prepared.inference).metadata();
  assert.ok(Math.max(metadata.width!, metadata.height!) <= 768);
  assert.equal(metadata.orientation, undefined);
  assert.ok(prepared.inference.length < 350000);
});
test("clearance first page waits for one query, retains verified sales, reuses cache and continues incrementally", async () => {
  const cache = new RequestCache(),
    usage = new UsageMeter();
  const queries: string[] = [];
  globalThis.fetch = async (url) => {
    queries.push(new URL(String(url)).searchParams.get("q")!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return json({
      shopping_results: [
        {
          title: "Beige trousers",
          source: "Store",
          product_id: `p${queries.length}`,
          price: "$20",
          old_price: "$40",
          link: `https://store.example/p${queries.length}`,
        },
        {
          title: "No verified sale",
          source: "Store",
          price: "$15",
          link: "https://store.example/no-sale",
        },
      ],
    });
  };
  const provider = new ShoppingFeedProvider(
    cache,
    new MetaProvider(config, cache, usage),
    new SerpProvider(config, cache, usage),
  );
  const input = FeedRequestSchema.parse({ mode: "clearance" }),
    profile = makeProfile("alice", "Alice");
  const first = await provider.page("alice", input, seedGarments, profile);
  assert.equal(queries.length, 1, "First paint does not await three searches");
  assert.equal(first.products.length, 1);
  assert.equal(first.products[0].offer.originalPrice, 40);
  await provider.page("alice", input, seedGarments, profile);
  assert.equal(queries.length, 1);
  const second = await provider.page(
    "alice",
    { ...input, page: first.nextPage! },
    seedGarments,
    profile,
  );
  assert.equal(queries.length, 2);
  assert.notEqual(first.products[0].id, second.products[0].id);
  assert.notEqual(queries[0], queries[1]);
  assert.equal(
    usage.snapshot().metaRequests,
    0,
    "Clearance never waits for AI planning",
  );
});

test("clothing mode personalizes shopping without overriding explicit user clothing choices", () => {
  assert.match(
    buildShoppingQuery({ query: "beige trousers", clothingMode: "women" }),
    /women’s beige trousers/,
  );
  assert.match(
    buildShoppingQuery({ query: "beige trousers", clothingMode: "men" }),
    /men’s beige trousers/,
  );
  assert.equal(
    buildShoppingQuery({ query: "women’s black shirt", clothingMode: "men" }),
    "women’s black shirt",
  );
  assert.ok(
    !buildShoppingQuery({
      query: "unisex hoodie",
      clothingMode: "women",
    }).includes("women’s"),
  );
});
