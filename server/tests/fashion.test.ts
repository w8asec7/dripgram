import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { z } from "zod";
import { buildApp } from "../app";
import { Principal } from "../auth";
import { UserDatabase } from "../firestore";
import { ConfigSchema } from "../config";
import { ApiError, RequestCache, UsageMeter } from "../core";
import { MetaProvider } from "../providers/meta";
import { SupabaseImages } from "../providers/images";
import { VoiceProvider, normalizedWave } from "../providers/voice";
import { FashionPost } from "../../src/models/posts";
import { postPiece } from "../../src/features/feed/domain";
import { seedGarments, makeProfile } from "../../src/mocks/seed";
import { normalizeProduct, filterLive } from "../providers/serp";
import { postImagePath, remixChoiceSchema } from "../fashion";
const config = ConfigSchema.parse({
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
  MODEL_API_KEY: "fixture",
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SECRET_KEY: "fixture",
});
const originalFetch = globalThis.fetch;
const directories: string[] = [];
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
const clothes = seedGarments
  .filter((g) => g.ownerId === "demo")
  .map((g) => ({ ...g, ownerId: "alice" }));
function post(photo = false): FashionPost {
  return {
    id: "post-one",
    ownerId: "alice",
    caption: "A weekend look",
    visibility: "friends",
    image: photo
      ? {
          uri: "",
          path: postImagePath("alice", "post-one", "v1"),
          version: "v1",
        }
      : null,
    pieces: photo
      ? []
      : [
          postPiece(clothes.find((g) => g.id === "g1")!),
          postPiece(clothes.find((g) => g.id === "g3")!),
        ],
    outfitId: null,
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    sample: false,
  };
}
class FixtureDB extends UserDatabase {
  value = post();
  allowed = new Set(["alice", "bob"]);
  constructor() {
    super("fixture");
  }
  override async get(p: Principal, path: string) {
    if (path.startsWith("posts/")) {
      if (!this.allowed.has(p.uid))
        throw new ApiError(403, "DATA_ACCESS", "This post is private.");
      return this.value as unknown as Record<string, unknown>;
    }
    return null;
  }
  override async garments(p: Principal) {
    return clothes.map((g) => ({
      ...g,
      ownerId: p.uid,
      availability: "laundry" as const,
    }));
  }
  override async profile(p: Principal) {
    return makeProfile(p.uid, p.uid);
  }
}
class FixtureMeta extends MetaProvider {
  calls: string[] = [];
  invalid = false;
  constructor() {
    super(config, new RequestCache(), new UsageMeter(), () => undefined);
  }
  override async structured<T>(
    _uid: string,
    kind: string,
    _prompt: string,
    schema: z.ZodType<T>,
    image?: string,
  ): Promise<T> {
    this.calls.push(kind);
    if (kind.startsWith("analysis_outfit")) {
      assert.ok(image?.startsWith("data:image/jpeg;base64,"));
      return schema.parse({
        pieces: post().pieces.map(({ id, image, ...piece }) => piece),
        summary: "Visible tee and trousers",
      });
    }
    return schema.parse({
      selections: [
        { garmentId: "g1", explanation: "Closest top", shoppingQuery: null },
        {
          garmentId: this.invalid ? "g1" : "g3",
          explanation: "Closest bottom",
          shoppingQuery: null,
        },
      ],
      summary: "A grounded remix",
    });
  }
}
class FixtureImages extends SupabaseImages {
  signed: string[] = [];
  uploaded: string[] = [];
  constructor() {
    super(config);
  }
  override async sign(path: string) {
    this.signed.push(path);
    return {
      path,
      signedUrl:
        "https://fixture.supabase.co/storage/v1/object/sign/photo?token=fixture",
      expiresAt: Date.now() + 300000,
      syncedAt: new Date().toISOString(),
    };
  }
  override async upload(path: string, _bytes: Buffer) {
    this.uploaded.push(path);
    return this.sign(path);
  }
}
function appFixture(
  db = new FixtureDB(),
  meta = new FixtureMeta(),
  images = new FixtureImages(),
) {
  const directory = mkdtempSync(join(tmpdir(), "thread-fashion-test-"));
  directories.push(directory);
  return {
    db,
    meta,
    images,
    app: buildApp({
      config,
      database: db,
      meta,
      images,
      directory,
      verify: async (header) => {
        const uid = header?.replace("Bearer ", "");
        if (!uid) throw new ApiError(401, "AUTH_REQUIRED", "Sign in.");
        return { uid, token: "fixture" };
      },
    }),
  };
}
test("structured-post remix skips vision, uses actual owned IDs and ignores legacy laundry", async () => {
  const { app, meta } = appFixture();
  const response = await app.inject({
    method: "POST",
    url: "/v1/ai/remix",
    headers: { authorization: "Bearer alice" },
    payload: { postId: "post-one" },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().analysisSource, "structured");
  assert.deepEqual(meta.calls, ["closet_remix_v2"]);
  assert.deepEqual(
    response.json().matches.map((m: { garmentId: string }) => m.garmentId),
    ["g1", "g3"],
  );
  await app.close();
});
test("photo-only analysis is reused across authorized viewers; revoked users cannot reuse cached analysis", async () => {
  const db = new FixtureDB();
  db.value = post(true);
  const { app, meta } = appFixture(db);
  const jpeg = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  globalThis.fetch = async () => new Response(new Uint8Array(jpeg));
  for (const uid of ["alice", "bob"]) {
    const r = await app.inject({
      method: "POST",
      url: "/v1/ai/remix",
      headers: { authorization: `Bearer ${uid}` },
      payload: { postId: "post-one" },
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  assert.equal(
    meta.calls.filter((k) => k.startsWith("analysis_outfit")).length,
    1,
  );
  db.allowed.delete("bob");
  const denied = await app.inject({
    method: "POST",
    url: "/v1/ai/remix",
    headers: { authorization: "Bearer bob" },
    payload: { postId: "post-one" },
  });
  assert.equal(denied.statusCode, 403);
  await app.close();
});
test("remix rejects hallucinated IDs and untrusted non-guest local demo payloads", async () => {
  const { app, meta } = appFixture();
  meta.invalid = true;
  const invalid = await app.inject({
    method: "POST",
    url: "/v1/ai/remix",
    headers: { authorization: "Bearer alice" },
    payload: { postId: "post-one" },
  });
  assert.equal(invalid.statusCode, 502);
  const demo = await app.inject({
    method: "POST",
    url: "/v1/ai/remix",
    headers: { authorization: "Bearer alice" },
    payload: {
      postId: "post-one",
      demo: { pieces: post().pieces, version: "v1" },
    },
  });
  assert.equal(demo.statusCode, 403);
  await app.close();
});
test("private post images deny outsiders, require selected garment references and reject malformed uploads", async () => {
  const { app, db, images } = appFixture();
  db.value = post(true);
  const denied = await app.inject({
    method: "POST",
    url: "/v1/posts/image/sign",
    headers: { authorization: "Bearer outsider" },
    payload: { postId: "post-one" },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(images.signed.length, 0);
  const allowed = await app.inject({
    method: "POST",
    url: "/v1/posts/image/sign",
    headers: { authorization: "Bearer bob" },
    payload: { postId: "post-one" },
  });
  assert.equal(allowed.statusCode, 200);
  const forged = await app.inject({
    method: "POST",
    url: "/v1/posts/image/sign",
    headers: { authorization: "Bearer bob" },
    payload: { postId: "post-one", garmentId: "private-unshared" },
  });
  assert.equal(forged.statusCode, 403);
  const malformed = await app.inject({
    method: "POST",
    url: "/v1/posts/image",
    headers: { authorization: "Bearer alice" },
    payload: {
      postId: "post-one",
      version: "v1",
      image: { base64: "not-an-image-but-long", mimeType: "image/jpeg" },
    },
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(images.uploaded.length, 0);
  assert.throws(() => postImagePath("alice", "../bob", "v1"));
  await app.close();
});
function wave(rate = 48000, seconds = 1) {
  const n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i / rate) * 440 * Math.PI * 2) * 5000),
      44 + i * 2,
    );
  return b;
}
test("voice validates bounded PCM recordings and normalizes actual hardware rate to Meta-compatible24kHz WAV", () => {
  const result = normalizedWave(wave().toString("base64"));
  assert.equal(result.bytes.readUInt32LE(24), 24000);
  assert.equal(result.bytes.length, 48044);
  assert.equal(result.durationMs, 1000);
  assert.throws(() =>
    normalizedWave(Buffer.from("not-a-wave").toString("base64")),
  );
  assert.throws(() => normalizedWave(wave(24000, 32).toString("base64")));
});
test("voice uses official multipart request, caches unchanged audio and records observed audio seconds", async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.meta.ai/v1/asr/transcribe");
    assert.ok(init?.body instanceof FormData);
    const body = init.body as FormData;
    const settings = JSON.parse(await (body.get("request") as Blob).text());
    assert.equal(settings.model, "muse-voice-transcribe-1.0");
    assert.equal(settings.audioEncoding, "WAV");
    assert.ok(body.get("audio") instanceof Blob);
    return new Response(
      JSON.stringify({
        transcript: "Red shirt and blue jeans",
        audioDurationMs: 1000,
      }),
    );
  };
  const usage = new UsageMeter(),
    voice = new VoiceProvider(config, new RequestCache(), usage),
    input = wave(24000).toString("base64");
  assert.equal(
    (await voice.transcribe("alice", input)).text,
    "Red shirt and blue jeans",
  );
  await voice.transcribe("alice", input);
  assert.equal(calls, 1);
  assert.equal(usage.snapshot().audioSeconds, 1);
});

test("remix response schema only accepts actual owned IDs or null, never missing sentinels or duplicate output branches", () => {
  const schema = remixChoiceSchema(["owned-top", "owned-bottom"], 2);
  assert.equal(
    schema.safeParse({
      selections: [
        { garmentId: "missing", explanation: "none", shoppingQuery: "shirt" },
        { garmentId: null, explanation: "none", shoppingQuery: "pants" },
      ],
      summary: "No owned matches",
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      selections: [
        {
          garmentId: null,
          explanation: "No matching top",
          shoppingQuery: "white shirt",
        },
        {
          garmentId: "owned-bottom",
          explanation: "Owned blue jeans",
          shoppingQuery: null,
        },
      ],
      summary: "One owned piece and one missing piece",
    }).success,
    true,
  );
});

test("shopping categories come from actual listing titles; filters never fabricate category metadata", async () => {
  const jacket = normalizeProduct(
    {
      title: "Blue denim jeans jacket",
      source: "Fixture",
      price: "$30",
      link: "https://example.test/jacket",
    },
    { query: "beige pants", category: "trousers" },
  )!;
  assert.equal(jacket.category, "jacket");
  assert.equal(
    filterLive([jacket], { query: "pants", group: "Bottoms" }).length,
    0,
  );
  const unknown = normalizeProduct(
    { title: "Everyday collection item", source: "Fixture", price: "$25" },
    { query: "shirts", category: "shirt" },
  )!;
  assert.equal(unknown.category, null);
  const white = normalizeProduct(
    {
      title: "White long sleeve button-up shirt",
      source: "Fixture",
      price: "$25",
    },
    { query: "white shirt" },
  )!;
  const black = normalizeProduct(
    { title: "Black flannel shirt", source: "Fixture", price: "$20" },
    { query: "white shirt" },
  )!;
  assert.equal(
    filterLive([black, white], { query: "white long sleeve shirt" })[0].id,
    white.id,
  );
});

test("clothing-post understanding reuses structured metadata without an outfit-matching call and reauthorizes access", async () => {
  const { app, db, meta } = appFixture();
  db.value = { ...post(), kind: "clothing" };
  const response = await app.inject({
    method: "POST",
    url: "/v1/posts/analyze",
    headers: { authorization: "Bearer alice" },
    payload: { postId: "post-one" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().original.pieces.length, 2);
  assert.deepEqual(meta.calls, []);
  const denied = await app.inject({
    method: "POST",
    url: "/v1/posts/analyze",
    headers: { authorization: "Bearer eve" },
    payload: { postId: "post-one" },
  });
  assert.equal(denied.statusCode, 403);
  await app.close();
});
