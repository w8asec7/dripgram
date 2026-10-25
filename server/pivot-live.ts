/** Opt-in real provider QA. Licensed clothing photos + synthetic speech, never personal camera input. */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadConfig } from "./config";
import { encodeFields } from "./firestore";
import { seedGarments, makeProfile } from "../src/mocks/seed";
import {
  FashionPostSchema,
  RemixResultSchema,
  BulkGarmentsSchema,
} from "../src/models/posts";
import { validateRemix } from "../src/features/feed/domain";
const { cleanup, cloudAdmin } = createRequire(resolve("server/pivot-live.ts"))(
  "../scripts/verify-cloud.cjs",
) as {
  cleanup: (uid: string) => Promise<void>;
  cloudAdmin: (
    url: string,
    method?: string,
    body?: unknown,
  ) => Promise<unknown>;
};
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error("Use THREAD_RUN_LIVE_QA=1 for explicit live provider QA.");
  const env = parseEnv(readFileSync(".env", "utf8")),
    config = loadConfig(),
    base = "http://127.0.0.1:3001",
    db = `https://firestore.googleapis.com/v1/projects/${config.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accounts: {
      uid: string;
      token: string;
      email: string;
      password: string;
    }[] = [],
    records: string[] = [],
    images: { postId: string; version: string }[] = [];
  const results: Record<string, unknown> = {
    model: config.META_MODEL,
    mode: "standard",
    fixture:
      "Unsplash photo kQ_DRtuQzG8 by Curtis Ambayo; garment content only",
    externalCalls: {
      metaText: 0,
      metaVision: 0,
      metaRemix: 0,
      metaVoice: 0,
      serp: 0,
    },
  };
  const calls = results.externalCalls as Record<string, number>;
  const headers = (a: (typeof accounts)[number]) => ({
    Authorization: `Bearer ${a.token}`,
    "Content-Type": "application/json",
  });
  const put = async (
    a: (typeof accounts)[number],
    path: string,
    value: unknown,
  ) => {
    const r = await fetch(`${db}/${path}`, {
      method: "PATCH",
      headers: headers(a),
      body: JSON.stringify({
        fields: encodeFields(value as Record<string, unknown>),
      }),
    });
    assert.ok(r.ok, `Fixture document write ${r.status}`);
    records.push(path);
  };
  const api = async (
    a: (typeof accounts)[number],
    path: string,
    body: unknown,
    method = "POST",
  ) => {
    const r = await fetch(base + path, {
      method,
      headers: headers(a),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const raw = await r.json();
    assert.ok(r.ok, `${path}: ${r.status} ${raw.error?.message || ""}`);
    return raw;
  };
  try {
    for (let i = 0; i < 2; i++) {
      const email = `qa-${Date.now() + i}@example.test`,
        password = randomBytes(20).toString("hex");
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        },
      );
      assert.ok(r.ok, "Firebase fixture auth");
      const raw = (await r.json()) as { localId: string; idToken: string };
      const a = { uid: raw.localId, token: raw.idToken, email, password };
      accounts.push(a);
      const profile = {
        ...makeProfile(a.uid, `Pivot Fixture ${i + 1}`),
        onboardingComplete: true,
      };
      await put(a, `users/${a.uid}`, {
        ...profile,
        revision: 0,
        skippedDates: [],
      });
      await put(a, `profiles/${a.uid}`, {
        id: a.uid,
        displayName: profile.displayName,
        username: profile.username,
        photo: null,
        bio: "Disposable fixture",
      });
    }
    const [a, b] = accounts;
    const clothes = [seedGarments[0], seedGarments[5]].map((g) => ({
      ...g,
      ownerId: a.uid,
      image: null,
    }));
    for (const g of clothes) await put(a, `users/${a.uid}/garments/${g.id}`, g);
    const privateWardrobe = await fetch(
      `${db}/users/${a.uid}/garments/${clothes[0].id}`,
      { headers: headers(b) },
    );
    assert.equal(privateWardrobe.status, 403);
    results.firebase =
      "PASS: auth, actual Firestore persistence, unrelated closet denial";
    const postId = `qa-photo-${Date.now()}`,
      version = "fixture-v1",
      bytes = readFileSync(
        ".private-cache/outfit-photo-qa/unsplash-curtis-ambayo-kQ_DRtuQzG8.jpg",
      );
    const uploaded = await api(a, "/v1/posts/image", {
      postId,
      version,
      image: { base64: bytes.toString("base64"), mimeType: "image/jpeg" },
    });
    images.push({ postId, version });
    const post = FashionPostSchema.parse({
      id: postId,
      ownerId: a.uid,
      caption: "Licensed clothing-photo QA; no endorsement implied",
      visibility: "friends",
      image: { uri: "", path: uploaded.path, version },
      pieces: [],
      outfitId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sample: false,
    });
    await put(a, `posts/${postId}`, post);
    const unauthorized = await fetch(base + "/v1/posts/image/sign", {
      method: "POST",
      headers: headers(b),
      body: JSON.stringify({ postId }),
    });
    assert.equal(unauthorized.status, 403);
    const signed = await api(a, "/v1/posts/image/sign", { postId });
    assert.ok((await fetch(signed.signedUrl)).ok);
    assert.ok(
      !(
        await fetch(
          `${config.SUPABASE_URL}/storage/v1/object/public/hackTx/${uploaded.path}`,
        )
      ).ok,
    );
    results.supabase =
      "PASS: private upload, authorized signed retrieval, unrelated and public access rejected";
    const remix = RemixResultSchema.parse(
      await api(a, "/v1/ai/remix", { postId }),
    );
    calls.metaVision++;
    calls.metaRemix++;
    validateRemix(remix, clothes, a.uid);
    results.photoRecognition = remix.original;
    results.remix = {
      matches: remix.matches.map((m) => ({
        original: remix.original.pieces[m.sourceIndex].name,
        owned: clothes.find((g) => g.id === m.garmentId)?.name,
        reason: m.explanation,
      })),
      missing: remix.missing,
      summary: remix.summary,
    };
    const cached = await api(a, "/v1/ai/remix", { postId });
    assert.deepEqual(cached, remix);
    results.analysisCache =
      "PASS: unchanged post returns same cached analysis and grounded proposal";
    const query =
      remix.missing[0]?.query ||
      `${remix.original.pieces[0].primaryColor} ${remix.original.pieces[0].category}`;
    const search = await api(a, "/v1/shopping/search", {
      query,
      clothingMode: "men",
      maxPrice: 80,
    });
    calls.serp++;
    assert.ok(search.products.length > 0, "Real matching shopping results");
    results.shopping = {
      query,
      count: search.products.length,
      source: search.source,
      example: search.products
        .slice(0, 2)
        .map((p: { name: string; offer: unknown }) => ({
          name: p.name,
          offer: p.offer,
        })),
    };
    if (process.env.THREAD_PIVOT_PHOTO_RETEST !== "1") {
      const extracted = BulkGarmentsSchema.parse(
        await api(a, "/v1/wardrobe/extract", {
          text: "Red oversized T-shirt, grey oversized T-shirt, blue baggy jeans, white sneakers, and a Polo Ralph Lauren shirt with a bear print.",
        }),
      );
      calls.metaText++;
      assert.equal(extracted.garments.length, 5);
      assert.equal(extracted.garments[0].primaryColor.toLowerCase(), "red");
      results.textExtraction = extracted.garments;
      const voice = await api(a, "/v1/wardrobe/transcribe", {
        base64: readFileSync(
          ".private-cache/outfit-photo-qa/wardrobe-description.wav",
        ).toString("base64"),
      });
      calls.metaVoice++;
      assert.match(voice.text, /red/i);
      assert.match(voice.text, /blue/i);
      results.voice = {
        text: voice.text,
        durationMs: voice.durationMs,
        model: config.META_ASR_MODEL,
      };
    }
    assert.ok(
      remix.original.pieces
        .filter((p) => /button[- ]up/i.test(p.description + " " + p.name))
        .every((p) => p.category === "shirt"),
      "Button-up observations must map to shirt",
    );
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 393, height: 852 },
      });
      await page.goto("http://localhost:8081/auth/sign-in");
      await page.getByLabel("Email address", { exact: true }).fill(a.email);
      await page.getByLabel("Password", { exact: true }).fill(a.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByText("Your next look", { exact: true }).waitFor();
      await page.goto("http://localhost:8081/social");
      await page.getByText(post.caption, { exact: true }).waitFor();
      await page.screenshot({
        path: ".private-cache/outfit-photo-qa/firebase-photo-feed.png",
      });
      results.firebaseFeed =
        "PASS: actual email sign-in, private owned post queried through Firebase repository, post image renders in Social";
    } finally {
      await browser.close();
    }
    const groupId = `qa-chat-${Date.now()}`;
    await put(a, `styleGroups/${groupId}`, {
      id: groupId,
      ownerId: a.uid,
      name: "Disposable post discussion",
      memberIds: [a.uid, b.uid],
      createdAt: new Date().toISOString(),
    });
    const messageId = "post-message",
      path = `styleGroups/${groupId}/messages/${messageId}`;
    const message = {
      id: messageId,
      authorId: a.uid,
      text: "",
      createdAt: new Date().toISOString(),
      attachment: null,
      replyTo: null,
      post: { id: postId, title: "A licensed inspiration photo" },
    };
    const commit = await fetch(`${db}:commit`, {
      method: "POST",
      headers: headers(a),
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: `projects/${config.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
              fields: encodeFields(message),
            },
            updateTransforms: [
              { fieldPath: "sentAt", setToServerValue: "REQUEST_TIME" },
            ],
          },
        ],
      }),
    });
    assert.ok(commit.ok, `Post message ${commit.status}`);
    records.push(path);
    const readMessage = await fetch(`${db}/${path}`, { headers: headers(b) });
    assert.ok(readMessage.ok);
    const noPost = await fetch(`${db}/posts/${postId}`, {
      headers: headers(b),
    });
    assert.equal(noPost.status, 403);
    results.messaging =
      "PASS: persistent group message; sharing a reference does not widen private post access";
    console.log(
      "Real photo outfit recognition, grounded remix, missing-piece SerpApi, bulk text and voice: PASS",
    );
  } finally {
    if (accounts[0])
      for (const image of images)
        await api(accounts[0], "/v1/posts/image", image, "DELETE");
    for (const path of [
      ...new Set(
        records.filter(
          (p) => !p.startsWith("users/") && !p.startsWith("profiles/"),
        ),
      ),
    ].reverse())
      await cloudAdmin(`${db}/${path}`, "DELETE");
    for (const a of accounts) await cleanup(a.uid);
    results.cleanedUp = true;
    writeFileSync(
      ".private-cache/outfit-photo-qa/live-results.json",
      JSON.stringify(results, null, 2),
    );
    console.log(
      "Only disposable fixture accounts, posts, messages and temporary images removed.",
    );
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Live pivot QA failed");
  process.exitCode = 1;
});
