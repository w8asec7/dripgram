// Fixture recognition response + real Firebase/Supabase persistence. No Meta/SerpApi requests.
const { Buffer } = require("node:buffer");
const { readFileSync } = require("node:fs");
const { parseEnv } = require("node:util");
const { chromium, expect } = require("@playwright/test");
const { cleanup } = require("./verify-cloud.cjs");
const { encodeFields } = require("../server/firestore.ts");
const { makeProfile } = require("../src/mocks/seed.ts");
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw Error("Opt in with THREAD_RUN_LIVE_QA=1");
  const env = parseEnv(readFileSync(".env", "utf8"));
  const password = Buffer.from(
    crypto.getRandomValues(new Uint8Array(24)),
  ).toString("hex");
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `qa-${Date.now()}@example.test`,
        password,
        returnSecureToken: true,
      }),
    },
  );
  if (!r.ok) throw Error("Fixture signup failed");
  const a = await r.json();
  const headers = {
    Authorization: `Bearer ${a.idToken}`,
    "Content-Type": "application/json",
  };
  const db = `https://firestore.googleapis.com/v1/projects/${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const profile = {
    ...makeProfile(a.localId, "Save Fixture"),
    onboardingComplete: true,
  };
  await fetch(`${db}/users/${a.localId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: encodeFields({ ...profile, revision: 0, skippedDates: [] }),
    }),
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  let id;
  try {
    await page.route("**/v1/ai/analyze", (route) =>
      route.fulfill({
        json: {
          analysis: {
            name: "Red T-Shirt",
            category: "t-shirt",
            subcategory: "tee",
            silhouette: "relaxed",
            texture: [],
            garmentRegion: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            primaryColor: "red",
            secondaryColors: [],
            pattern: "solid",
            fit: "unknown",
            styleTags: ["Casual"],
            brand: null,
            material: null,
            season: [],
            occasions: [],
            description: "A red shirt.",
            searchKeywords: ["red shirt"],
            uncertainFields: ["fit"],
            confidence: "medium",
            colorReview: "",
          },
          source: "meta",
          model: "fixture-response-no-live-inference",
        },
      }),
    );
    await page.goto("http://localhost:8081/auth/sign-in");
    await page.getByLabel("Email address", { exact: true }).fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("Today, made easy", { exact: true }).waitFor();
    await page.goto("http://localhost:8081/garment/new");
    await page
      .getByLabel("Garment name", { exact: true })
      .fill("My custom red shirt");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Photo library", exact: true })
      .click();
    await (await chooser).setFiles("tests/fixtures/red-shirt.jpg");
    await page
      .getByText("META RECOGNITION · REVIEW BEFORE SAVING", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Add to my wardrobe", exact: true })
      .click();
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "docs/screenshots/phase3-save-diagnostic.png",
    });
    console.log("Save diagnostic path:", new URL(page.url()).pathname);
    console.log((await page.locator("body").innerText()).slice(-2400));
    await expect(page).not.toHaveURL(/\/garment\/new$/, { timeout: 60000 });
    id = page.url().split("/").at(-1);
    await expect(
      page
        .getByText("My custom red shirt", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    console.log("Fixture response + real persistence: PASS");
  } finally {
    if (id)
      await fetch("http://localhost:3001/v1/images/thumbnail", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ garmentId: id }),
      });
    await browser.close();
    await cleanup(a.localId);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
