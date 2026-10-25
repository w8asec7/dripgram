/** Opt-in one-query Clearance check. Creates/removes only its disposable QA scope. */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { loadConfig } from "./config";
import { encodeFields } from "./firestore";
import { makeProfile } from "../src/mocks/seed";
import { FeedPageSchema } from "../shared/feed";
const { cleanup } = createRequire(resolve("server/clearance-live.ts"))(
  "../scripts/verify-cloud.cjs",
) as { cleanup: (uid: string) => Promise<void> };
async function main() {
  loadConfig();
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error(
      "Set THREAD_RUN_LIVE_QA=1 to spend up to one search request.",
    );
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const signup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,
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
  const auth = (await signup.json()) as { idToken?: string; localId?: string };
  if (!signup.ok || !auth.idToken || !auth.localId)
    throw new Error("Disposable QA authentication failed.");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.idToken}`,
  };
  try {
    const profile = await fetch(
      `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${auth.localId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          fields: encodeFields({
            ...makeProfile(auth.localId, "Clearance Fixture"),
            revision: 0,
            skippedDates: [],
          }),
        }),
      },
    );
    if (!profile.ok) throw new Error("QA profile could not be saved.");
    const input = JSON.stringify({ mode: "clearance" });
    const run = async () => {
      const started = Date.now();
      const response = await fetch("http://127.0.0.1:3001/v1/shopping/feed", {
        method: "POST",
        headers,
        body: input,
      });
      if (!response.ok)
        throw new Error(`Clearance request failed (${response.status}).`);
      return {
        result: FeedPageSchema.parse(await response.json()),
        elapsedMs: Date.now() - started,
      };
    };
    const first = await run(),
      cached = await run();
    if (
      first.result.source !== "live" ||
      first.result.products.some(
        (p) =>
          p.offer.originalPrice === null ||
          p.offer.price === null ||
          p.offer.originalPrice <= p.offer.price,
      )
    )
      throw new Error("Clearance returned an unverified sale.");
    const report = {
      source:
        "real authenticated backend + SerpApi; one initial query and one cache replay",
      firstBatchMs: first.elapsedMs,
      cachedReplayMs: cached.elapsedMs,
      verifiedDiscountProducts: first.result.products.length,
      nextPage: first.result.nextPage,
      checkedAt: first.result.checkedAt,
      maxSearchRequests: 1,
    };
    await writeFile(
      "docs/clearance-live-results.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.info(JSON.stringify(report));
  } finally {
    await cleanup(auth.localId);
  }
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Clearance smoke failed");
  process.exitCode = 1;
});
