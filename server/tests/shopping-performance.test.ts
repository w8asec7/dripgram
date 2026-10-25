import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../app";
import { UserDatabase } from "../firestore";
import { SerpProvider } from "../providers/serp";
import { ConfigSchema } from "../config";
import { RequestCache, UsageMeter } from "../core";
import { makeProfile, seedGarments } from "../../src/mocks/seed";
test(
  "shopping starts four independent authorized context reads together and emits sanitized stage timings",
  { timeout: 3000 },
  async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let count = 0;
    const arrive = async () => {
      count++;
      if (count === 4) release();
      await gate;
    };
    class Context extends UserDatabase {
      override async garments() {
        await arrive();
        return seedGarments;
      }
      override async profile() {
        await arrive();
        return makeProfile("demo", "Fixture");
      }
      override async list() {
        await arrive();
        return [];
      }
    }
    const config = ConfigSchema.parse({
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread",
    });
    class Listings extends SerpProvider {
      override async search() {
        return {
          products: [],
          partial: false,
          source: "live" as const,
          message: "Synthetic provider fixture",
          checkedAt: "2026-10-25T00:00:00.000Z",
        };
      }
    }
    const app = buildApp({
      config,
      database: new Context("demo-thread"),
      verify: async () => ({ uid: "demo", token: "private-fixture-token" }),
      serp: new Listings(config, new RequestCache(), new UsageMeter()),
      directory: await mkdtemp(join(tmpdir(), "dripgram-timing-")),
    });
    try {
      const r = await app.inject({
        method: "POST",
        url: "/v1/shopping/feed",
        payload: { mode: "discover", filters: { query: "fixture shirt" } },
      });
      assert.equal(r.statusCode, 200);
      assert.equal(count, 4);
      assert.match(
        String(r.headers["server-timing"]),
        /auth;dur=.*context;dur=.*plan;dur=.*total;dur=/,
      );
      assert.ok(
        !String(r.headers["server-timing"]).includes("private-fixture-token"),
      );
    } finally {
      await app.close();
    }
  },
);
