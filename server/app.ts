import { ShoppingTiming } from "./timing";
import { VoiceProvider } from "./providers/voice";
import { registerFashion } from "./fashion";
import { ShoppingFeedProvider } from "./providers/feed";
import { FeedRequestSchema } from "../shared/feed";
import { WeatherProvider } from "./providers/weather";
import { WeatherPreferenceSchema } from "../shared/weather";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { ChatTargetSchema } from "../src/models/chat";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Config, loadConfig } from "./config";
import { ApiError, RequestCache, UsageMeter, hash } from "./core";
import { firebaseVerifier, Principal, VerifyToken } from "./auth";
import { UserDatabase } from "./firestore";
import { MetaProvider } from "./providers/meta";
import { SerpProvider } from "./providers/serp";
import { SupabaseImages, prepareImage, storagePath } from "./providers/images";
import {
  ImagePayloadSchema,
  RecommendRequestSchema,
  AdviceSchema,
} from "../shared/protocol";
import {
  Product,
  ProductSchema,
  GarmentSchema,
  CartItemSchema,
  PriceWatchSchema,
} from "../src/models";
import { SearchRequestSchema } from "../src/services/shopping";
import {
  WardrobeInsightSchema,
  GroupResultSchema,
  OccasionInterpretationSchema,
} from "../src/services/ai";
export interface AppDependencies {
  config?: Config;
  verify?: VerifyToken;
  database?: UserDatabase;
  meta?: MetaProvider;
  serp?: SerpProvider;
  images?: SupabaseImages;
  directory?: string;
}
export function buildApp(deps: AppDependencies = {}) {
  const config = deps.config ?? loadConfig(),
    directory = deps.directory ?? "server/.data";
  const cache = new RequestCache(join(directory, "cache")),
    usage = new UsageMeter(join(directory, "usage.json"));
  const db =
      deps.database ?? new UserDatabase(config.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    meta = deps.meta ?? new MetaProvider(config, cache, usage),
    serp = deps.serp ?? new SerpProvider(config, cache, usage),
    images = deps.images ?? new SupabaseImages(config),
    verify =
      deps.verify ?? firebaseVerifier(config.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  const weather = new WeatherProvider(cache);
  const voice = new VoiceProvider(config, cache, usage);
  const feed = new ShoppingFeedProvider(cache, meta, serp);
  const app = Fastify({
    logger: false,
    bodyLimit: 5_000_000,
    requestTimeout: 60000,
  });
  const allowed = config.ALLOWED_WEB_ORIGINS.split(",").map((s) => s.trim());
  app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["Server-Timing"],
  });
  const principals = new WeakMap<object, Principal>();
  const requestTimings = new WeakMap<object, ShoppingTiming>();
  app.addHook("onRequest", async (request) => {
    if (request.url.startsWith("/v1/shopping/"))
      requestTimings.set(request, new ShoppingTiming());
  });
  const windows = new Map<string, { start: number; count: number }>();
  app.addHook("preHandler", async (request) => {
    if (request.method === "OPTIONS" || request.url === "/health") return;
    const timing = requestTimings.get(request);
    const p = await (timing
      ? timing.measure("auth", () => verify(request.headers.authorization))
      : verify(request.headers.authorization));
    principals.set(request, p);
    const now = Date.now(),
      w = windows.get(p.uid);
    if (w && now - w.start < 60000) {
      if (w.count >= 90)
        throw new ApiError(
          429,
          "RATE_LIMIT",
          "Too many requests. Wait a minute and try again.",
          60,
        );
      w.count++;
    } else windows.set(p.uid, { start: now, count: 1 });
    if (windows.size > 1000)
      for (const [k, v] of windows)
        if (now - v.start > 60000) windows.delete(k);
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.retryAfterSeconds)
        reply.header("Retry-After", String(error.retryAfterSeconds));
      return reply.status(error.status).send({
        error: {
          code: error.code,
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
      });
    }
    const status =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    if (error instanceof z.ZodError || status === 400 || status === 413)
      return reply.status(status === 413 ? 413 : 400).send({
        error: {
          code: "INVALID_REQUEST",
          message:
            "Check the form or choose a smaller, valid image and try again.",
        },
      });
    return reply.status(503).send({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message:
          "The service could not complete this request. Your saved wardrobe is safe. Please retry.",
      },
    });
  });
  const who = (request: object) => principals.get(request)!;
  const catalogPath = (uid: string, id: string) =>
    join(directory, "products", hash(uid + ":" + id) + ".json");
  async function retain(p: Principal, products: Product[]) {
    await mkdir(join(directory, "products"), { recursive: true, mode: 0o700 });
    await Promise.all(
      products.map((product) =>
        writeFile(catalogPath(p.uid, product.id), JSON.stringify(product), {
          mode: 0o600,
        }),
      ),
    );
  }
  async function product(p: Principal, id: string) {
    let stored: unknown;
    try {
      stored = JSON.parse(await readFile(catalogPath(p.uid, id), "utf8"));
    } catch {
      stored = await db.product(p, id);
    }
    const result = ProductSchema.safeParse(stored);
    if (!result.success)
      throw new ApiError(
        404,
        "PRODUCT_MISSING",
        "This listing is unavailable. Search again to check current offers.",
      );
    return result.data;
  }
  app.get("/health", async () => ({
    ok: true,
    model: config.META_MODEL,
    mode: "standard",
    meta: !!config.MODEL_API_KEY,
    shopping: !!config.SERPAPI_API_KEY,
    storage: !!(
      config.SUPABASE_URL &&
      (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_SECRET_KEY)
    ),
    automaticPriceTracking: false,
  }));
  app.get("/v1/usage", async () => ({
    usage: usage.snapshot(),
    limits: {
      metaPerDay: config.MAX_META_CALLS_PER_DAY,
      serpPerDay: config.MAX_SERP_CALLS_PER_DAY,
    },
    model: config.META_MODEL,
    mode: "standard",
    scope: "this-backend-instance",
    remainingCredits: null,
  }));
  app.post("/v1/weather/cities", async (request) =>
    weather.cities(
      z.object({ query: z.string().trim().min(2).max(100) }).parse(request.body)
        .query,
    ),
  );
  app.post("/v1/weather", async (request) => {
    const profile = await db.profile(who(request));
    const pref = WeatherPreferenceSchema.safeParse(profile.weather);
    return pref.success && pref.data.enabled
      ? weather.current(pref.data)
      : null;
  });
  app.post("/v1/wardrobe/transcribe", async (request) => {
    const input = z
      .object({ base64: z.string().min(60).max(4_200_000) })
      .parse(request.body);
    return voice.transcribe(who(request).uid, input.base64);
  });
  app.post("/v1/ai/analyze", async (request) => {
    const p = who(request),
      input = ImagePayloadSchema.parse(request.body);
    const prepared = await prepareImage(input);
    const result = await meta.analyze(
      p.uid,
      `data:image/jpeg;base64,${prepared.inference.toString("base64")}`,
    );
    return { analysis: result, source: "meta", model: config.META_MODEL };
  });
  app.post("/v1/ai/outfit", async (request) => {
    const p = who(request),
      input = RecommendRequestSchema.parse(request.body);
    const [garments, profile] = await Promise.all([
      db.garments(p),
      db.profile(p),
    ]);
    const pref = WeatherPreferenceSchema.safeParse(profile.weather);
    const currentWeather =
      pref.success && pref.data.enabled
        ? await weather.current(pref.data).catch(() => null)
        : null;
    return meta.outfit(
      p.uid,
      garments,
      input,
      profile.preferences,
      currentWeather,
    );
  });
  app.post("/v1/ai/wardrobe", async (request) => {
    const p = who(request),
      garments = await db.garments(p);
    const schema = z.object({
      insights: z
        .array(
          WardrobeInsightSchema.omit({ category: true }).extend({
            category: GarmentSchema.shape.category.nullable(),
          }),
        )
        .max(5),
    });
    const result = await meta.structured(
      p.uid,
      "wardrobe",
      JSON.stringify({
        task: "Give brief wardrobe-aware guidance. First recommend using owned clothes; suggest buying only for a useful gap, and suggest borrowing where appropriate. Do not claim a missing category unless actually missing.",
        garments: garments.map((g) => ({
          id: g.id,
          category: g.category,
          color: g.primaryColor,
          styles: g.styleTags,
        })),
      }),
      schema,
    );
    return {
      insights: result.insights.map((i) => ({
        ...i,
        category: i.category ?? undefined,
      })),
      source: "meta",
    };
  });
  app.post("/v1/ai/group", async (request) => {
    const p = who(request),
      { occasionId } = z
        .object({ occasionId: z.string().min(1).max(128) })
        .parse(request.body);
    const context = await db.occasionContext(p, occasionId);
    return meta.structured(
      p.uid,
      "group",
      JSON.stringify({
        task: "Recommend a serious group palette and coordination using only these intentionally shared outfit snapshots. Do not infer private wardrobes or recommend unowned pieces as owned. Return source meta and 3-5 hex palette colors.",
        occasion: context.occasion,
        snapshots: context.submissions,
      }),
      GroupResultSchema,
    );
  });
  app.post("/v1/ai/occasion", async (request) => {
    const p = who(request),
      input = z.object({ type: z.string().max(80) }).parse(request.body);
    return meta.structured(
      p.uid,
      "occasion",
      JSON.stringify({
        task: "Interpret this occasion briefly with a useful dress code and two tips.",
        ...input,
      }),
      OccasionInterpretationSchema,
    );
  });
  app.post("/v1/shopping/feed", async (request, reply) => {
    const timing = requestTimings.get(request) || new ShoppingTiming();
    const p = who(request),
      input = FeedRequestSchema.parse(request.body);
    const [garments, profile, cartRows, watchRows] = await timing.measure(
      "context",
      () =>
        Promise.all([
          db.garments(p),
          db.profile(p),
          db.list(p, `users/${p.uid}/cart`).catch(() => []),
          db.list(p, `users/${p.uid}/watches`).catch(() => []),
        ]),
    );
    const shoppingContext = [
      ...cartRows.flatMap((row) => {
        const parsed = CartItemSchema.safeParse(row);
        return parsed.success ? [parsed.data.product] : [];
      }),
      ...watchRows.flatMap((row) => {
        const parsed = PriceWatchSchema.safeParse(row);
        return parsed.success && parsed.data.product
          ? [parsed.data.product]
          : [];
      }),
    ].slice(0, 12);
    const result = await feed.page(
      p.uid,
      input,
      garments,
      profile,
      shoppingContext,
      timing,
    );
    await timing.measure("retain", () => retain(p, result.products));
    reply.header("Server-Timing", timing.header());
    return result;
  });
  app.post("/v1/shopping/search", async (request) => {
    const p = who(request),
      input = SearchRequestSchema.parse(request.body);
    const profile = await db.profile(p);
    const result = await serp.search({
      ...input,
      clothingMode:
        input.clothingMode ?? profile.preferences.clothingMode ?? "men",
    });
    await retain(p, result.products);
    return result;
  });
  app.post("/v1/shopping/visual", async (request) => {
    const p = who(request),
      input = z
        .object({ image: ImagePayloadSchema, filters: SearchRequestSchema })
        .parse(request.body);
    const { inference } = await prepareImage(input.image);
    const temp = `users/${p.uid}/visual/${hash(inference)}.jpg`;
    let uploaded = false;
    try {
      const result = await serp.visual(
        p.uid,
        hash(inference),
        async () => {
          const signed = await images.upload(temp, inference);
          uploaded = true;
          return signed.signedUrl;
        },
        input.filters,
      );
      await retain(p, result.products);
      return result;
    } finally {
      if (uploaded) await images.remove(temp).catch(() => undefined);
    }
  });
  app.get<{ Params: { id: string } }>(
    "/v1/shopping/products/:id",
    async (request) => {
      const p = who(request),
        saved = await product(p, request.params.id);
      let result = saved;
      try {
        result = await serp.merchant(saved);
      } catch {
        /* Keep the genuine provider listing when merchant enrichment is unavailable. */
      }
      await retain(p, [result]);
      await db.saveProduct(p, result.id, result);
      return result;
    },
  );
  app.post("/v1/shopping/compare", async (request) => {
    const p = who(request),
      { ids } = z
        .object({ ids: z.array(z.string().max(128)).max(50) })
        .parse(request.body);
    return Promise.all(ids.map((id) => product(p, id)));
  });
  app.post<{ Params: { id: string } }>(
    "/v1/shopping/products/:id/refresh",
    async (request) => {
      const p = who(request),
        original = await product(p, request.params.id);
      const result = await serp.search(
        { query: original.name, sort: "relevance" },
        true,
      );
      const match = result.products.find(
        (x) =>
          (original.providerId &&
            x.providerId === original.providerId &&
            x.offer.retailer === original.offer.retailer) ||
          (x.name.toLowerCase() === original.name.toLowerCase() &&
            x.offer.retailer === original.offer.retailer),
      );
      if (
        !match ||
        match.offer.price === null ||
        match.offer.currency !== original.offer.currency
      )
        throw new ApiError(
          404,
          "OFFER_UNVERIFIED",
          "Could not verify the same offer in the same currency. Your previous price history was preserved.",
        );
      const updated = { ...match, id: original.id };
      await retain(p, [updated]);
      await db.saveProduct(p, updated.id, updated);
      return updated;
    },
  );
  app.post<{ Params: { id: string } }>(
    "/v1/shopping/products/:id/advice",
    async (request) => {
      const p = who(request),
        found = await product(p, request.params.id),
        garments = await db.garments(p);
      const advice = await meta.structured(
        p.uid,
        "shopping_advice",
        JSON.stringify({
          task: "Should this person consider this actual listing? Prefer owned clothes, identify redundancies and complementary owned items. Return only supplied garment IDs. Do not invent prices or compatibility percentages.",
          product: found,
          wardrobe: garments.map((g) => ({
            id: g.id,
            category: g.category,
            color: g.primaryColor,
            styles: g.styleTags,
          })),
        }),
        AdviceSchema,
      );
      const ids = new Set(garments.map((g) => g.id));
      if (
        [...advice.matchingGarmentIds, ...advice.similarOwnedIds].some(
          (id) => !ids.has(id),
        )
      )
        throw new ApiError(
          502,
          "ADVICE_IDS",
          "AI advice referenced an unknown piece. Retry the advice.",
        );
      return advice;
    },
  );
  app.post("/v1/images/thumbnail", async (request) => {
    const p = who(request),
      input = z
        .object({ garmentId: z.string(), image: ImagePayloadSchema })
        .parse(request.body);
    await db.authorizeImage(p, p.uid, input.garmentId);
    const { thumbnail } = await prepareImage(input.image);
    return images.upload(storagePath(p.uid, input.garmentId), thumbnail);
  });
  app.post("/v1/images/sign", async (request) => {
    const p = who(request),
      input = z
        .object({
          ownerId: z.string(),
          garmentId: z.string(),
          occasionId: z.string().max(128).optional(),
          lookId: z.string().max(128).optional(),
          chat: ChatTargetSchema.extend({
            messageId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
          }).optional(),
        })
        .parse(request.body);
    await db.authorizeImage(
      p,
      input.ownerId,
      input.garmentId,
      input.occasionId,
      input.lookId,
      input.chat,
    );
    return images.sign(storagePath(input.ownerId, input.garmentId));
  });
  app.delete("/v1/images/thumbnail", async (request) => {
    const p = who(request),
      { garmentId } = z.object({ garmentId: z.string() }).parse(request.body);
    await db.authorizeImage(p, p.uid, garmentId);
    await images.remove(storagePath(p.uid, garmentId));
    return { deleted: true };
  });
  registerFashion(app, { who, db, meta, images, cache });
  return app;
}
