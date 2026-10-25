/** Explicit opt-in only. Uses synthetic art, real providers and disposable Firebase records. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { loadConfig } from "./config";
import { encodeFields } from "./firestore";
import { seedGarments, makeProfile } from "../src/mocks/seed";
const { cleanup } = createRequire(resolve("server/live-check.ts"))(
  "../scripts/verify-cloud.cjs",
) as { cleanup: (uid: string) => Promise<void> };
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error(
      "Set THREAD_RUN_LIVE_QA=1 to use a small number of real provider requests.",
    );
  const e = parseEnv(readFileSync(".env", "utf8")),
    config = loadConfig(),
    base = process.env.THREAD_QA_API_URL || "http://127.0.0.1:3001";
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${e.EXPO_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `qa-${Date.now()}@example.test`,
        password: randomBytes(20).toString("hex"),
        returnSecureToken: true,
      }),
    },
  );
  assert.ok(signUp.ok, "Disposable Firebase authentication failed.");
  const { idToken: token, localId: uid } = (await signUp.json()) as {
    idToken: string;
    localId: string;
  };
  const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    db = `https://firestore.googleapis.com/v1/projects/${config.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  let uploaded = false;
  async function call(path: string, body: unknown, method = "POST") {
    const r = await fetch(base + path, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    assert.ok(r.ok, `Application endpoint failed (${r.status}): ${path}`);
    return r.json() as Promise<Record<string, unknown>>;
  }
  try {
    const profile = makeProfile(uid, "Fixture QA");
    let r = await fetch(`${db}/users/${uid}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        fields: encodeFields({ ...profile, revision: 0, skippedDates: [] }),
      }),
    });
    assert.ok(r.ok);
    console.log("Firebase Auth + Firestore: PASS");
    for (const [i, g] of seedGarments.slice(0, 4).entries()) {
      r = await fetch(`${db}/users/${uid}/garments/fixture-${i}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          fields: encodeFields({
            ...g,
            id: `fixture-${i}`,
            ownerId: uid,
            image: null,
          }),
        }),
      });
      assert.ok(r.ok);
    }
    const image = {
      base64: readFileSync(
        "tests/fixtures/white-oversized-tshirt.jpg",
      ).toString("base64"),
      mimeType: "image/jpeg",
    };
    const thumbnail = await call("/v1/images/thumbnail", {
      garmentId: "fixture-0",
      image,
    });
    uploaded = true;
    assert.equal(
      thumbnail.path,
      `users/${uid}/garments/fixture-0/thumbnail.jpg`,
    );
    const signed = await call("/v1/images/sign", {
      ownerId: uid,
      garmentId: "fixture-0",
    });
    assert.ok((await fetch(String(signed.signedUrl))).ok);
    const publicRead = await fetch(
      `${config.SUPABASE_URL}/storage/v1/object/public/${config.SUPABASE_STORAGE_BUCKET}/users/${uid}/garments/fixture-0/thumbnail.jpg`,
    );
    assert.equal(publicRead.ok, false);
    const denied = await fetch(base + "/v1/images/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: uid, garmentId: "fixture-0" }),
    });
    assert.equal(denied.status, 401);
    console.log(
      "Supabase private upload / authorized retrieval / public denial: PASS",
    );
    const recognition = await call("/v1/ai/analyze", image);
    assert.equal(recognition.source, "meta");
    console.log("Meta fixture recognition: PASS");
    const outfit = await call("/v1/ai/outfit", {
      occasionType: "Casual day",
      variation: 0,
    });
    assert.equal(outfit.source, "meta");
    assert.ok(outfit.outfit);
    console.log("Meta grounded outfit: PASS");
    const shopping = await call("/v1/shopping/search", {
      query: "white oversized cotton t shirt",
      maxPrice: 50,
      sort: "price",
    });
    assert.equal(shopping.source, "live");
    assert.ok(Array.isArray(shopping.products));
    console.log("SerpApi Shopping: PASS");
    const lens = await call("/v1/shopping/visual", {
      image,
      filters: { query: "white t shirt" },
    });
    assert.equal(lens.source, "live");
    assert.ok(Array.isArray(lens.products));
    console.log("SerpApi Lens: PASS");
  } finally {
    if (uploaded) {
      await call("/v1/images/thumbnail", { garmentId: "fixture-0" }, "DELETE");
      console.log("Temporary thumbnail removed.");
    }
    await cleanup(uid);
    console.log("Disposable Firebase account and records removed.");
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Live checks could not complete. No credentials were printed.",
  );
  process.exitCode = 1;
});
