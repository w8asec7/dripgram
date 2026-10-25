/** Opt-in real Firebase persistence QA. No model/search calls or personal photos. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { encodeFields, decodeFields } from "./firestore";
import { makeProfile, seedGarments } from "../src/mocks/seed";
const { cleanup, cloudAdmin } = createRequire(
  resolve("server/feedback-live.ts"),
)("../scripts/verify-cloud.cjs") as {
  cleanup: (uid: string) => Promise<void>;
  cloudAdmin: (
    url: string,
    method?: string,
    body?: unknown,
  ) => Promise<unknown>;
};
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error("Explicit live QA flag required.");
  const env = parseEnv(readFileSync(".env", "utf8"));
  const db = `https://firestore.googleapis.com/v1/projects/${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `qa-${Date.now()}@example.test`,
        password: randomBytes(24).toString("hex"),
        returnSecureToken: true,
      }),
    },
  );
  assert.ok(r.ok, "Disposable authentication failed.");
  const account = (await r.json()) as { localId: string; idToken: string };
  const uid = account.localId,
    path = `users/${uid}/outfitFeedback/qa-feedback`;
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${db}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${account.idToken}`,
        "Content-Type": "application/json",
      },
      body:
        body === undefined
          ? undefined
          : JSON.stringify({
              fields: encodeFields(body as Record<string, unknown>),
            }),
    });
    assert.ok(
      response.ok,
      `Firebase fixture operation failed (${response.status}).`,
    );
    return response.json().catch(() => ({ fields: {} })) as Promise<{
      fields: Record<string, unknown>;
    }>;
  };
  try {
    await request(`users/${uid}`, "PATCH", makeProfile(uid, "Feedback QA"));
    const garment = { ...seedGarments[0], ownerId: uid };
    await request(`users/${uid}/garments/${garment.id}`, "PATCH", garment);
    const before = await request(`users/${uid}/garments/${garment.id}`);
    const feedback = {
      id: "qa-feedback",
      ownerId: uid,
      outfitId: "qa-feedback",
      garmentIds: [garment.id],
      occasionType: "Casual day",
      response: "wore",
      createdAt: "2026-10-25T12:00:00.000Z",
      updatedAt: "2026-10-25T12:00:00.000Z",
    };
    await request(path, "PATCH", feedback);
    assert.equal(decodeFields((await request(path)).fields).response, "wore");
    await request(path, "PATCH", { ...feedback, response: "did-not-wear" });
    assert.equal(
      decodeFields((await request(path)).fields).response,
      "did-not-wear",
    );
    const denied = await fetch(`${db}/${path}`);
    assert.ok(!denied.ok, "Unauthenticated feedback unexpectedly readable.");
    assert.deepEqual(
      (await request(`users/${uid}/garments/${garment.id}`)).fields,
      before.fields,
    );
    await request(path, "DELETE");
    const removed = await fetch(`${db}/${path}`, {
      headers: { Authorization: `Bearer ${account.idToken}` },
    });
    assert.equal(removed.status, 404);
    const report = {
      authentication: "PASS",
      feedbackCreateReadChangeUndo: "PASS",
      unauthenticatedAccessDenied: "PASS",
      garmentUnchanged: "PASS",
      metaRequests: 0,
      serpRequests: 0,
    };
    writeFileSync(
      "docs/ux-live-feedback.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.info(JSON.stringify(report));
  } finally {
    await cloudAdmin(`${db}/${path}`, "DELETE");
    await cleanup(uid);
    console.info("Only disposable QA account/records removed.");
  }
}
main().catch(() => {
  console.error(
    "Live feedback verification failed; inspect authentication/rules/configuration without exposing credentials.",
  );
  process.exitCode = 1;
});
