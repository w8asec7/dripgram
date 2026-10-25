/** Explicit fixture-only live QA. Never opens the camera or prints credentials. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { loadConfig } from "./config";
import { encodeFields, decodeFields } from "./firestore";
import { makeProfile, seedGarments } from "../src/mocks/seed";
const { cleanup, cloudAdmin } = createRequire(resolve("server/phase3-live.ts"))(
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
    throw new Error(
      "Set THREAD_RUN_LIVE_QA=1 to authorize limited live fixture checks.",
    );
  const env = parseEnv(readFileSync(".env", "utf8")),
    config = loadConfig(),
    base = "http://127.0.0.1:3001",
    db = `https://firestore.googleapis.com/v1/projects/${config.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const accounts: {
    uid: string;
    token: string;
    email: string;
    password: string;
  }[] = [];
  const createdDocs: string[] = [];
  let uploaded = false;
  const ledger = { metaRequests: 0, serpRequests: 0, weatherRequests: 0 };
  const headers = (a: (typeof accounts)[number]) => ({
    Authorization: `Bearer ${a.token}`,
    "Content-Type": "application/json",
  });
  const backend = async (
    a: (typeof accounts)[number],
    path: string,
    body: unknown,
    expected = 200,
    method = "POST",
  ) => {
    const r = await fetch(base + path, {
      method,
      headers: headers(a),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(r.status, expected, `${path}: unexpected status ${r.status}`);
    return r.json() as Promise<Record<string, unknown>>;
  };
  const put = async (
    a: (typeof accounts)[number],
    path: string,
    value: unknown,
  ) => {
    const r = await fetch(db + "/" + path, {
      method: "PATCH",
      headers: headers(a),
      body: JSON.stringify({
        fields: encodeFields(value as Record<string, unknown>),
      }),
    });
    assert.ok(r.ok, `Firestore fixture write failed (${r.status})`);
    createdDocs.push(path);
  };
  try {
    for (let i = 0; i < 3; i++) {
      const email = `qa-${Date.now() + i}@example.test`,
        password = randomBytes(20).toString("hex");
      const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      assert.ok(r.ok, "Disposable signup failed");
      const a = (await r.json()) as { localId: string; idToken: string };
      const account = { uid: a.localId, token: a.idToken, email, password };
      accounts.push(account);
      const profile = {
        ...makeProfile(account.uid, "Fixture QA " + i),
        onboardingComplete: true,
      };
      await put(account, `users/${account.uid}`, {
        ...profile,
        revision: 0,
        skippedDates: [],
      });
      await put(account, `profiles/${account.uid}`, {
        id: account.uid,
        displayName: profile.displayName,
        username: profile.username,
        photo: null,
      });
    }
    const [alice, bob, eve] = accounts;
    const usageBefore = (await fetch(base + "/v1/usage", {
      headers: headers(alice),
    }).then((r) => r.json())) as Record<string, unknown>;
    console.log("Firebase Auth + Firestore: PASS");
    for (const [i, category] of [
      "t-shirt",
      "trousers",
      "hoodie",
      "shoes",
    ].entries()) {
      const g = seedGarments.find((g) => g.category === category)!;
      await put(alice, `users/${alice.uid}/garments/fixture-${i}`, {
        ...g,
        id: `fixture-${i}`,
        ownerId: alice.uid,
        availability: "available",
        image: null,
      });
    }
    const image = {
      base64: readFileSync("tests/fixtures/red-shirt.jpg").toString("base64"),
      mimeType: "image/jpeg",
    };
    await backend(alice, "/v1/images/thumbnail", {
      garmentId: "fixture-0",
      image,
    });
    uploaded = true;
    const own = await backend(alice, "/v1/images/sign", {
      ownerId: alice.uid,
      garmentId: "fixture-0",
    });
    assert.ok((await fetch(String(own.signedUrl))).ok);
    assert.equal(
      (
        await fetch(
          `${config.SUPABASE_URL}/storage/v1/object/public/${config.SUPABASE_STORAGE_BUCKET}/users/${alice.uid}/garments/fixture-0/thumbnail.jpg`,
        )
      ).ok,
      false,
    );
    await backend(
      eve,
      "/v1/images/sign",
      { ownerId: alice.uid, garmentId: "fixture-0" },
      403,
    );
    console.log(
      "Supabase hackTx private upload / own retrieval / unauthorized denial: PASS",
    );
    if (process.env.THREAD_PHASE3_ONLY !== "social") {
      for (const [file, color] of process.env.THREAD_PHASE3_RECOGNITION ===
      "red-only"
        ? []
        : [
            ["white-oversized-tshirt.jpg", "white"],
            ["black-hoodie.jpg", "black"],
          ]) {
        ledger.metaRequests++;
        const result = await backend(alice, "/v1/ai/analyze", {
          base64: readFileSync("tests/fixtures/" + file).toString("base64"),
          mimeType: "image/jpeg",
        });
        const analysis = result.analysis as {
          primaryColor: string;
          name: string;
        };
        assert.ok(
          color === "black"
            ? /black|charcoal|dark gr[ae]y/i.test(analysis.primaryColor)
            : analysis.primaryColor.toLowerCase().includes(color),
          `Fixture recognition color expected ${color}, received ${analysis.primaryColor}`,
        );
        console.log(`Meta ${color} fixture: PASS (${analysis.primaryColor})`);
      }
      // Test the real frontend preprocessing/mapping/review/save/restart path with a red fixture.
      let browserPage: import("@playwright/test").Page | undefined;
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 393, height: 852 },
        });
        browserPage = page;
        await page.goto("http://localhost:8081/auth/sign-in");
        await page
          .getByLabel("Email address", { exact: true })
          .fill(alice.email);
        await page.getByLabel("Password", { exact: true }).fill(alice.password);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.getByText("Today, made easy", { exact: true }).waitFor();
        await page.goto("http://localhost:8081/garment/new");
        await page
          .getByLabel("Garment name", { exact: true })
          .fill("My custom red shirt");
        const chooser = page.waitForEvent("filechooser");
        await page
          .getByRole("button", { name: "Photo library", exact: true })
          .click();
        ledger.metaRequests++;
        await (await chooser).setFiles("tests/fixtures/red-shirt.jpg");
        await page
          .getByText("META RECOGNITION · REVIEW BEFORE SAVING", { exact: true })
          .waitFor({ timeout: 60000 });
        await expect(
          page.getByLabel("Primary color", { exact: true }),
        ).toHaveValue(/red/i);
        await expect(
          page.getByLabel("Garment name", { exact: true }),
        ).toHaveValue("My custom red shirt");
        await page.screenshot({
          path: "docs/screenshots/phase3-live-red-review.png",
        });
        await page
          .getByRole("button", { name: "Add to my wardrobe", exact: true })
          .click();
        await page.waitForURL((url) => !url.pathname.endsWith("/garment/new"), {
          timeout: 60000,
        });
        await page
          .getByText("My custom red shirt", { exact: true })
          .filter({ visible: true })
          .waitFor();
        await page.reload();
        await page
          .getByText("My custom red shirt", { exact: true })
          .filter({ visible: true })
          .waitFor();
        await page
          .getByText("PRIVATE THUMBNAIL SYNCED", { exact: true })
          .waitFor();
        await page.screenshot({
          path: "docs/screenshots/phase3-live-red-saved.png",
        });
        const newId = page.url().split("/").at(-1)!;
        await backend(
          alice,
          "/v1/images/thumbnail",
          { garmentId: newId },
          200,
          "DELETE",
        );
        console.log(
          "Red garment frontend compression / image request / custom-name mapping / save / restart / thumbnail: PASS",
        );
      } catch (e) {
        if (browserPage) {
          await browserPage.screenshot({
            path: "docs/screenshots/phase3-live-error.png",
          });
          console.log(
            "UI diagnostic:",
            new URL(browserPage.url()).pathname,
            (await browserPage.locator("body").innerText()).slice(-1800),
          );
        }
        throw e;
      } finally {
        await browser.close();
      }
      ledger.metaRequests++;
      const outfit = await backend(alice, "/v1/ai/outfit", {
        occasionType: "Casual hangout",
        includeAccessories: false,
      });
      const records = (await fetch(`${db}/users/${alice.uid}/garments`, {
        headers: headers(alice),
      }).then((r) => r.json())) as {
        documents?: { fields: Record<string, unknown> }[];
      };
      const ownedIds = new Set(
        records.documents?.map((d) => decodeFields(d.fields).id),
      );
      const look = outfit.outfit as {
        items: { garmentId: string; role: string }[];
      };
      assert.ok(look);
      assert.ok(look.items.length >= 2 && look.items.length <= 3);
      assert.ok(
        look.items.every(
          (i) =>
            ownedIds.has(i.garmentId) &&
            !["shoes", "accessory"].includes(i.role),
        ),
      );
      console.log("Meta grounded simple outfit: PASS");
      ledger.metaRequests++;
      ledger.serpRequests++;
      const page0 = await backend(alice, "/v1/shopping/feed", {
        mode: "complete",
        page: 0,
      });
      assert.equal(page0.source, "live");
      assert.ok((page0.products as unknown[]).length > 0);
      ledger.serpRequests++;
      const page1 = await backend(alice, "/v1/shopping/feed", {
        mode: "complete",
        page: 1,
      });
      assert.notEqual(page0.query, page1.query);
      assert.equal(page1.source, "live");
      console.log(
        `Personalized real shopping query groups: PASS (${(page0.products as unknown[]).length} + ${(page1.products as unknown[]).length} listings)`,
      );
      ledger.serpRequests++;
      const sales = await backend(alice, "/v1/shopping/feed", {
        mode: "clearance",
        page: 0,
      });
      assert.ok(
        (
          sales.products as {
            offer: { price: number; originalPrice: number };
          }[]
        ).every((p) => p.offer.originalPrice > p.offer.price),
      );
      console.log(
        `Verified clearance discounts: PASS (${(sales.products as unknown[]).length} current listings)`,
      );
      ledger.weatherRequests++;
      const cities = await backend(alice, "/v1/weather/cities", {
        query: "Austin",
      });
      const city = (
        cities as unknown as {
          name: string;
          latitude: number;
          longitude: number;
          timezone: string;
        }[]
      ).find((c) => c.timezone === "America/Chicago")!;
      assert.ok(city);
      const profile = {
        ...makeProfile(alice.uid, "Fixture QA"),
        onboardingComplete: true,
        weather: { ...city, enabled: true },
      };
      await put(alice, `users/${alice.uid}`, {
        ...profile,
        revision: 1,
        skippedDates: [],
      });
      ledger.weatherRequests++;
      const weather = await backend(alice, "/v1/weather", {});
      assert.equal(weather.source, "Open-Meteo");
      assert.equal(typeof weather.temperatureF, "number");
      console.log("Manual-city weather: PASS");
    }
    const pair = [alice.uid, bob.uid].sort().join("_");
    const friendshipCreatedAt = new Date().toISOString();
    await put(alice, `friendRequests/${pair}`, {
      id: pair,
      fromId: alice.uid,
      toId: bob.uid,
      status: "pending",
      createdAt: friendshipCreatedAt,
    });
    await put(bob, `friendRequests/${pair}`, {
      id: pair,
      fromId: alice.uid,
      toId: bob.uid,
      status: "accepted",
      createdAt: friendshipCreatedAt,
    });
    await put(bob, `friendships/${pair}`, {
      id: pair,
      members: [alice.uid, bob.uid].sort(),
      createdAt: friendshipCreatedAt,
    });
    const gid = "qa-group-" + Date.now(),
      lid = "qa-look-" + Date.now();
    await put(alice, `styleGroups/${gid}`, {
      id: gid,
      ownerId: alice.uid,
      name: "Fixture group",
      memberIds: [alice.uid, bob.uid],
      createdAt: new Date().toISOString(),
    });
    await put(alice, `sharedLooks/${lid}`, {
      id: lid,
      ownerId: alice.uid,
      title: "Fixture shared red shirt",
      groupId: gid,
      parentId: null,
      outfitId: null,
      audienceIds: [alice.uid, bob.uid],
      pieces: [
        {
          id: "fixture-0",
          name: "Red shirt",
          category: "t-shirt",
          primaryColor: "red",
          image: null,
        },
      ],
      createdAt: new Date().toISOString(),
    });
    const shared = await backend(bob, "/v1/images/sign", {
      ownerId: alice.uid,
      garmentId: "fixture-0",
      lookId: lid,
    });
    assert.ok((await fetch(String(shared.signedUrl))).ok);
    await backend(
      eve,
      "/v1/images/sign",
      { ownerId: alice.uid, garmentId: "fixture-0", lookId: lid },
      403,
    );
    await backend(
      bob,
      "/v1/images/sign",
      { ownerId: alice.uid, garmentId: "fixture-1", lookId: lid },
      403,
    );
    await put(bob, `sharedLooks/${lid}/comments/fixture-comment`, {
      id: "fixture-comment",
      authorId: bob.uid,
      text: "Try black pants.",
      createdAt: new Date().toISOString(),
    });
    await put(bob, `sharedLooks/${lid}/reactions/${bob.uid}`, {
      userId: bob.uid,
    });
    console.log(
      "Live group selected-image permission / outsider denial / forged-piece denial / comment / reaction: PASS",
    );
    const usageAfter = (await fetch(base + "/v1/usage", {
      headers: headers(alice),
    }).then((r) => r.json())) as Record<string, unknown>;
    writeFileSync(
      process.env.THREAD_PHASE3_ONLY === "social"
        ? "docs/phase3-social-authorization-results.json"
        : "docs/phase3-live-results.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          status: "PASS",
          model: config.META_MODEL,
          mode: "Standard",
          requestsRequested: ledger,
          usageBefore,
          usageAfter,
          physicalCamera: "NOT TESTED",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Live fixture checks complete. Usage ledger written without credentials.",
    );
  } finally {
    if (uploaded && accounts[0])
      await backend(
        accounts[0],
        "/v1/images/thumbnail",
        { garmentId: "fixture-0" },
        200,
        "DELETE",
      );
    const ownPaths = [
      ...new Set(
        createdDocs.filter(
          (p) => !p.startsWith("users/") && !p.startsWith("profiles/"),
        ),
      ),
    ];
    for (const path of ownPaths.reverse())
      await cloudAdmin(db + "/" + path, "DELETE");
    for (const a of accounts) await cleanup(a.uid);
    console.log(
      "Only disposable fixture accounts, records and uploaded test images were removed.",
    );
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Live fixture QA failed.",
  );
  process.exitCode = 1;
});
