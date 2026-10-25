/** Explicit, minimal live QA; no camera or personal photographs. */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { encodeFields } from "./firestore";
import { seedGarments, makeProfile } from "../src/mocks/seed";
const { cleanup } = createRequire(resolve("server/polish-live.ts"))(
  "../scripts/verify-cloud.cjs",
) as { cleanup: (uid: string) => Promise<void> };
const statePath = ".private-cache/polish-live-account.json",
  reportPath = ".private-cache/polish-live-results.json";
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error("Live QA must be explicitly enabled.");
  const stage = process.argv[2] || "baseline";
  if (!["baseline", "after", "cleanup"].includes(stage))
    throw new Error("Use baseline, after or cleanup.");
  const env = parseEnv(readFileSync(".env", "utf8"));
  let account: { uid: string; token: string };
  if (existsSync(statePath))
    account = JSON.parse(readFileSync(statePath, "utf8"));
  else {
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
    assert.ok(r.ok, "Disposable authentication");
    const a = (await r.json()) as { localId: string; idToken: string };
    account = { uid: a.localId, token: a.idToken };
    writeFileSync(statePath, JSON.stringify(account), { mode: 0o600 });
    const db = `https://firestore.googleapis.com/v1/projects/${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
    for (const [path, value] of [
      [
        `users/${account.uid}`,
        {
          ...makeProfile(account.uid, "Polish QA"),
          revision: 0,
          skippedDates: [],
        },
      ],
      ...seedGarments.map((g) => [
        `users/${account.uid}/garments/${g.id}`,
        { ...g, ownerId: account.uid },
      ]),
    ] as [string, Record<string, unknown>][]) {
      const r = await fetch(`${db}/${path}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${account.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: encodeFields(value) }),
      });
      assert.ok(r.ok, "Fixture write");
    }
  }
  if (stage === "cleanup") {
    await cleanup(account.uid);
    unlinkSync(statePath);
    console.info("Disposable QA account cleaned without provider calls.");
    return;
  }
  const rows: unknown[] = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8"))
    : [];
  const request = async (path: string, body: unknown) => {
    const start = performance.now();
    const r = await fetch(`http://127.0.0.1:3001${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    assert.ok(r.ok, `${path} failed (${r.status})`);
    return {
      data,
      ms: Math.round(performance.now() - start),
      server: r.headers.get("server-timing"),
    };
  };
  try {
    const input = {
      mode: "discover",
      filters: { query: "plain oversized cotton t shirt" },
      page: 0,
    };
    for (const [label, filters] of [
      ["initial", input.filters],
      ["repeat", input.filters],
      ["price-filter", { ...input.filters, maxPrice: 45 }],
    ] as const) {
      const r = await request("/v1/shopping/feed", { ...input, filters });
      rows.push({
        stage,
        label,
        ms: r.ms,
        serverTiming: r.server,
        products: r.data.products.length,
        checkedAt: r.data.checkedAt,
      });
    }
    if (stage === "after") {
      for (const id of ["g1", "g3", "g4"]) {
        const r = await request("/v1/ai/outfit", {
          occasionType: "Casual day",
          requiredGarmentId: id,
        });
        assert.ok(
          r.data.outfit.items.some(
            (i: { garmentId: string }) => i.garmentId === id,
          ),
        );
        rows.push({
          stage,
          requiredGarmentId: id,
          grounded: true,
          source: r.data.source,
          ms: r.ms,
        });
      }
    }
    writeFileSync(reportPath, JSON.stringify(rows, null, 2) + "\n");
    console.info(JSON.stringify(rows));
  } finally {
    if (stage === "after" || stage === "cleanup") {
      await cleanup(account.uid);
      unlinkSync(statePath);
      console.info("Disposable fixture account cleaned.");
    }
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Polish QA failed");
  process.exitCode = 1;
});
