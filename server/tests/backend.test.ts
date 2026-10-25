import { test, afterEach } from "node:test";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { buildApp } from "../app";
import { ConfigSchema } from "../config";
import {
  ApiError,
  RequestCache,
  UsageMeter,
  parseModelJson,
  providerFetch,
} from "../core";
import { firebaseVerifier, Principal } from "../auth";
import { UserDatabase, encodeFields, decodeFields } from "../firestore";
import { MetaProvider, validateOutfitIds } from "../providers/meta";
import { SupabaseImages, prepareImage, storagePath } from "../providers/images";
import {
  SerpProvider,
  normalizeProduct,
  filterLive,
  buildShoppingQuery,
} from "../providers/serp";
import { seedGarments, makeProfile } from "../../src/mocks/seed";
import { RecognitionSchema } from "../../shared/protocol";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const config = ConfigSchema.parse({
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
  MODEL_API_KEY: "fixture-meta",
  SERPAPI_API_KEY: "fixture-serp",
  SUPABASE_URL: "https://fixture.supabase.co/rest/v1/",
  SUPABASE_SECRET_KEY: "fixture-secret",
  META_MODEL: "muse-spark-1.2",
});
const garments = [
  { ...seedGarments[0], id: "tee", ownerId: "alice" },
  { ...seedGarments[2], id: "pants", ownerId: "alice" },
  { ...seedGarments[3], id: "shoes", ownerId: "alice" },
];
const recognition = {
  name: "White oversized tee",
  category: "t-shirt",
  subcategory: "crewneck tee",
  silhouette: "relaxed",
  texture: [],
  garmentRegion: null,
  primaryColor: "white",
  secondaryColors: [],
  pattern: "solid",
  fit: "oversized",
  styleTags: ["Casual"],
  brand: null,
  material: null,
  season: ["summer"],
  occasions: ["classes"],
  description: "A white cotton-style oversized tee.",
  searchKeywords: ["white oversized t shirt"],
  uncertainFields: ["material", "brand"],
  confidence: "medium",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("config enforces Standard mode and normalizes Supabase project origin", () => {
  assert.equal(config.SUPABASE_URL, "https://fixture.supabase.co");
  assert.throws(() =>
    ConfigSchema.parse({ ...config, META_MODEL: "muse-spark-1.2-contributor" }),
  );
});
test("model JSON parsing rejects malformed output and validates attributes", () => {
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => parseModelJson("invalid"));
  assert.equal(RecognitionSchema.parse(recognition).category, "t-shirt");
  assert.equal(
    RecognitionSchema.safeParse({ ...recognition, category: "spacesuit" })
      .success,
    false,
  );
});
test("grounding rejects unknown, foreign, duplicate and role-mismatched IDs; legacy laundry never blocks styling", () => {
  const valid = {
    name: "Classes",
    items: [
      { garmentId: "tee", role: "top" as const },
      { garmentId: "pants", role: "bottom" as const },
    ],
    explanation: "Neutral colors for class.",
  };
  assert.doesNotThrow(() =>
    validateOutfitIds(valid, garments, "alice", "Classes"),
  );
  for (const ids of [
    [{ garmentId: "missing", role: "top" as const }, valid.items[1]],
    [{ garmentId: "pants", role: "top" as const }, valid.items[1]],
    [valid.items[0], valid.items[0]],
  ])
    assert.throws(() =>
      validateOutfitIds({ ...valid, items: ids }, garments, "alice", "Classes"),
    );
  assert.throws(() => validateOutfitIds(valid, garments, "bob", "Classes"));
  assert.doesNotThrow(() =>
    validateOutfitIds(
      valid,
      garments.map((g) => ({ ...g, availability: "laundry" as const })),
      "alice",
      "Classes",
    ),
  );
});
test("cache deduplicates simultaneous and persisted requests without caching failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thread-cache-"));
  const cache = new RequestCache(dir);
  let count = 0;
  const loader = async () => {
    count++;
    await new Promise((r) => setTimeout(r, 10));
    return { ok: true };
  };
  const values = await Promise.all(
    Array.from({ length: 5 }, () => cache.get("same", 60000, loader)),
  );
  assert.equal(count, 1);
  assert.equal(values.length, 5);
  await new RequestCache(dir).get("same", 60000, loader);
  assert.equal(count, 1);
  let attempts = 0;
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      cache.get("bad", 60000, async () => {
        attempts++;
        throw new Error("no");
      }),
    );
  assert.equal(attempts, 2);
});
test("daily budgets remain bounded under concurrent calls and survive restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thread-usage-"));
  const file = join(dir, "usage.json");
  const meter = new UsageMeter(file);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => meter.count("meta", 2)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(meter.snapshot().metaRequests, 2);
  assert.equal(new UsageMeter(file).snapshot().metaRequests, 2);
  await meter.tokens(10, 20);
  assert.equal(JSON.parse(await readFile(file, "utf8")).outputTokens, 20);
});
test("image fixtures resize without distortion and reject malformed bytes or traversal", async () => {
  const svg = Buffer.from(
    '<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="900" fill="white"/><path d="M180 150H420V700H180Z" fill="black"/></svg>',
  );
  const jpg = await sharp(svg).jpeg().toBuffer();
  const prepared = await prepareImage({
    base64: jpg.toString("base64"),
    mimeType: "image/jpeg",
  });
  const metadata = await sharp(prepared.thumbnail).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.ok(prepared.thumbnail.length < 50000);
  assert.equal(
    storagePath("alice", "tee"),
    "users/alice/garments/tee/thumbnail.jpg",
  );
  assert.throws(() => storagePath("../bob", "tee"));
  await assert.rejects(
    prepareImage({
      base64: Buffer.from("this is not a garment photo").toString("base64"),
      mimeType: "image/jpeg",
    }),
  );
});
test("prices, missing fields, real discounts and currency safety are preserved", () => {
  const p = normalizeProduct(
    {
      title: "Black hoodie",
      source: "Retailer",
      extracted_price: 25,
      extracted_old_price: 50,
      price: "$25",
      link: "https://retailer.example/item",
    },
    { query: "" },
  )!;
  assert.equal(p.offer.price, 25);
  assert.equal(p.offer.originalPrice, 50);
  assert.equal(p.brand, null);
  assert.equal(p.similarity, null);
  assert.equal(p.sample, false);
  assert.equal(
    filterLive([p], { query: "", onSale: true, maxPrice: 30 }).length,
    1,
  );
  assert.equal(filterLive([p], { query: "", maxPrice: 20 }).length, 0);
  assert.equal(
    normalizeProduct(
      { title: "Euro item", price: "€20", extracted_price: 20 },
      { query: "" },
    ),
    null,
  );
  const missing = normalizeProduct(
    { title: "No price", link: "https://retailer.example" },
    { query: "" },
  )!;
  assert.equal(missing.offer.price, null);
  assert.equal(missing.offer.retailer, null);
  assert.match(
    buildShoppingQuery({
      query: "hoodie",
      fit: "oversized",
      color: "black",
      occasion: "casual",
    }),
    /oversized/,
  );
});
test("Meta adapter sends a bounded inline image, validates structured output and deduplicates analysis", async () => {
  let count = 0;
  globalThis.fetch = async (_url, options) => {
    count++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "muse-spark-1.2");
    assert.equal(body.reasoning_effort, config.META_REASONING_EFFORT);
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.max_completion_tokens, config.META_MAX_OUTPUT_TOKENS);
    assert.ok(body.max_completion_tokens <= 4096);
    assert.equal(
      body.messages[1].content[1].image_url.url,
      "data:image/jpeg;base64,fixture",
    );
    return response({
      choices: [
        {
          message: { content: JSON.stringify(recognition) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
  };
  const meter = new UsageMeter(),
    meta = new MetaProvider(config, new RequestCache(), meter);
  await Promise.all([
    meta.analyze("alice", "data:image/jpeg;base64,fixture"),
    meta.analyze("alice", "data:image/jpeg;base64,fixture"),
  ]);
  assert.equal(count, 1);
  assert.equal(meter.snapshot().inputTokens, 10);
});
test("Meta failures and truncated or invalid responses return recoverable errors", async () => {
  const meta = new MetaProvider(config, new RequestCache(), new UsageMeter());
  globalThis.fetch = async () =>
    response({
      choices: [{ message: { content: "{" }, finish_reason: "length" }],
      usage: { completion_tokens: 1600 },
    });
  await assert.rejects(
    meta.analyze("alice", "truncated"),
    (e: unknown) => e instanceof ApiError && e.code === "MODEL_TOKEN_LIMIT",
  );
  globalThis.fetch = async () => response({ error: "limited" }, 429);
  await assert.rejects(
    meta.analyze("alice", "limited"),
    (e: unknown) => e instanceof ApiError && e.status === 429,
  );
});
test("Shopping/Lens adapters use supported engines and preserve no fabricated exact-match claims", async () => {
  const calls: URL[] = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    calls.push(u);
    if (u.searchParams.get("engine") === "google_lens") {
      assert.equal(u.searchParams.has("type"), false);
      return response({
        visual_matches: [
          {
            title: "White tee",
            source: "Store",
            link: "https://store.example/tee",
            price: { extracted_value: 20, currency: "USD" },
          },
        ],
      });
    }
    return response({
      shopping_results: [
        {
          title: "White tee",
          source: "Store",
          price: "$20",
          extracted_price: 20,
          link: "https://store.example/tee",
        },
      ],
    });
  };
  const serp = new SerpProvider(config, new RequestCache(), new UsageMeter());
  const first = await serp.search({ query: "white tee" });
  await serp.search({ query: "white tee" });
  assert.equal(calls.length, 1);
  assert.equal(first.products[0].offer.price, 20);
  const lens = await serp.visual(
    "alice",
    "hash",
    async () => "https://fixture.example/short-lived.jpg",
    { query: "tee" },
  );
  assert.equal(lens.products[0].matchType, "similar");
  assert.equal(calls.length, 2);
});
test("Supabase adapter uses private bucket, privileged headers only server-side, and short signed URLs", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.match(String(url), /^https:\/\/fixture.supabase.co\/storage\/v1\//);
    const headers = options?.headers as Record<string, string>;
    assert.equal(headers.apikey, "fixture-secret");
    if (String(url).includes("/bucket/"))
      return response({ id: "hackTx", public: false });
    if (String(url).includes("/object/sign/")) {
      assert.equal(JSON.parse(String(options?.body)).expiresIn, 300);
      return response({
        signedURL:
          "/object/sign/hackTx/users/alice/garments/tee/thumbnail.jpg?token=fixture",
      });
    }
    return response({});
  };
  const images = new SupabaseImages(config);
  const upload = await images.upload(
    storagePath("alice", "tee"),
    Buffer.from("fixture"),
  );
  assert.match(upload.signedUrl, /\/storage\/v1\/object\/sign\/hackTx\//);
  assert.ok(upload.expiresAt > Date.now());
  assert.equal(calls, 3);
});
test("Supabase never proceeds when the bucket is public or missing", async () => {
  globalThis.fetch = async () => response({ id: "hackTx", public: true });
  await assert.rejects(
    new SupabaseImages(config).verifyBucket(),
    (e: unknown) => e instanceof ApiError && e.code === "BUCKET_PRIVACY",
  );
  globalThis.fetch = async () => response({ error: "missing" }, 404);
  await assert.rejects(new SupabaseImages(config).verifyBucket());
});
test("Firebase ID-token verification rejects missing, malformed and foreign tokens", async () => {
  const verify = firebaseVerifier("demo-thread");
  await assert.rejects(
    verify(undefined),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  await assert.rejects(
    verify("Bearer not-a-jwt"),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
});
test("Firestore field encoding preserves arrays, nulls and booleans", () => {
  const source = {
    id: "g",
    price: 12.5,
    active: true,
    image: null,
    tags: ["casual"],
    nested: { count: 2 },
  };
  assert.deepEqual(decodeFields(encodeFields(source)), source);
});
class FixtureDatabase extends UserDatabase {
  constructor() {
    super("demo-thread");
  }
  override async get(p: Principal, path: string) {
    if (path === `users/${p.uid}/garments/tee` && p.uid === "alice")
      return garments[0];
    return null;
  }
  override async garments(p: Principal) {
    return p.uid === "alice" ? garments : [];
  }
  override async profile(p: Principal) {
    return makeProfile(p.uid, "Fixture User");
  }
}
test("backend rejects unauthenticated and cross-user private images before touching storage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thread-api-"));
  let reads = 0;
  class Images extends SupabaseImages {
    override async sign(path: string) {
      reads++;
      return {
        path,
        signedUrl: "https://fixture.example/signed",
        expiresAt: Date.now() + 300000,
        syncedAt: new Date().toISOString(),
      };
    }
  }
  const app = buildApp({
    config,
    directory: dir,
    database: new FixtureDatabase(),
    images: new Images(config),
    verify: async (auth) => {
      const uid =
        auth === "Bearer alice"
          ? "alice"
          : auth === "Bearer bob"
            ? "bob"
            : null;
      if (!uid) throw new ApiError(401, "AUTH_REQUIRED", "Sign in.");
      return { uid, token: "fixture" };
    },
  });
  try {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/images/sign",
          payload: { ownerId: "alice", garmentId: "tee" },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/images/sign",
          headers: { authorization: "Bearer bob" },
          payload: { ownerId: "alice", garmentId: "tee" },
        })
      ).statusCode,
      403,
    );
    assert.equal(reads, 0);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/images/sign",
          headers: { authorization: "Bearer alice" },
          payload: { ownerId: "alice", garmentId: "tee" },
        })
      ).statusCode,
      200,
    );
    assert.equal(reads, 1);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/v1/images/thumbnail",
          headers: { authorization: "Bearer alice" },
          payload: {
            garmentId: "tee",
            image: { base64: "invalid", mimeType: "video/mp4" },
          },
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
test("provider timeouts do not expose URLs, keys or raw errors", async () => {
  globalThis.fetch = async () => {
    throw new Error("secret-key-in-URL");
  };
  await assert.rejects(
    providerFetch("https://provider.example/?api_key=secret-key-in-URL"),
    (e: unknown) =>
      e instanceof ApiError && !e.message.includes("secret-key-in-URL"),
  );
});

test("Firebase verification checks signature, expiry, issuer and project audience", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "fixture";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const verify = firebaseVerifier("demo-thread", keys);
  const token = async (
    aud = "demo-thread",
    issuer = "https://securetoken.google.com/demo-thread",
    expires = "5m",
  ) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "fixture" })
      .setSubject("alice")
      .setAudience(aud)
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey);
  assert.equal((await verify("Bearer " + (await token()))).uid, "alice");
  for (const value of [
    await token("other-project"),
    await token("demo-thread", "https://evil.example"),
    await token(
      "demo-thread",
      "https://securetoken.google.com/demo-thread",
      "-1h",
    ),
  ])
    await assert.rejects(
      verify("Bearer " + value),
      (e: unknown) => e instanceof ApiError && e.status === 401,
    );
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "fixture" })
    .setSubject("alice")
    .setAudience("demo-thread")
    .setIssuer("https://securetoken.google.com/demo-thread")
    .setExpirationTime("5m")
    .sign(other.privateKey);
  await assert.rejects(verify("Bearer " + forged));
});

test("all six licensed fixtures load and produce small retained thumbnails", async () => {
  for (const name of [
    "white-oversized-tshirt",
    "black-hoodie",
    "blue-jeans",
    "beige-pants",
    "sneakers",
    "patterned-shirt",
  ]) {
    const input = await readFile(`tests/fixtures/${name}.jpg`);
    const result = await prepareImage({
      base64: input.toString("base64"),
      mimeType: "image/jpeg",
    });
    const thumbnail = await sharp(result.thumbnail).metadata();
    const inference = await sharp(result.inference).metadata();
    assert.equal(thumbnail.width, 256);
    assert.equal(thumbnail.height, 256);
    assert.ok(result.thumbnail.length < 100000);
    assert.ok(Math.max(inference.width!, inference.height!) <= 1024);
  }
});
test("manual price refresh rejects changed currency/merchant and persists only verified observations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "thread-price-"));
  const saved = normalizeProduct(
    {
      title: "White tee",
      source: "Store",
      product_id: "sku-one",
      price: "$20",
      extracted_price: 20,
      link: "https://store.example/one",
    },
    { query: "" },
  )!;
  let latest: typeof saved = { ...saved, offer: { ...saved.offer, price: 18 } };
  let writes = 0;
  class Database extends FixtureDatabase {
    override async product(p: Principal) {
      return p.uid === "alice" ? saved : null;
    }
    override async saveProduct(_p: Principal, _id: string, product: unknown) {
      assert.equal((product as typeof saved).offer.price, 18);
      writes++;
    }
  }
  class Shopping extends SerpProvider {
    override async search() {
      return {
        products: [latest],
        partial: false,
        source: "live" as const,
        message: null,
      };
    }
  }
  const app = buildApp({
    config,
    directory: dir,
    database: new Database(),
    serp: new Shopping(config, new RequestCache(), new UsageMeter()),
    verify: async () => ({ uid: "alice", token: "fixture" }),
  });
  try {
    const url = `/v1/shopping/products/${saved.id}/refresh`;
    const request = () => app.inject({ method: "POST", url, payload: {} });
    assert.equal((await request()).statusCode, 200);
    assert.equal(writes, 1);
    latest = { ...latest, offer: { ...latest.offer, currency: "EUR" } };
    assert.equal((await request()).statusCode, 404);
    assert.equal(writes, 1);
    latest = {
      ...saved,
      offer: { ...saved.offer, retailer: "Other merchant" },
    };
    assert.equal((await request()).statusCode, 404);
    assert.equal(writes, 1);
  } finally {
    await app.close();
  }
});
