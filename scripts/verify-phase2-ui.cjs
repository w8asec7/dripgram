// Opt-in real providers with a synthetic gallery image. Never activates camera.
const { chromium, expect } = require("@playwright/test");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const { parseEnv } = require("node:util");
const { cleanup, cloudAdmin } = require("./verify-cloud.cjs");
const project = "thread-hacktx-2026-rp",
  base = "http://localhost:8081";
const results = [];
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error(
      "Requires THREAD_RUN_LIVE_QA=1. This uses a small number of real provider requests.",
    );
  const e = parseEnv(readFileSync(".env", "utf8")),
    email = `qa-${Date.now()}@example.test`,
    password = randomBytes(20).toString("hex");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(65000);
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  let uid, token, garmentId;
  const headers = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  const record = (name) => {
    results.push(name);
    console.log(name + ": PASS");
  };
  const shot = async (name) => {
    mkdirSync("docs/screenshots", { recursive: true });
    await page.screenshot({ path: `docs/screenshots/phase2-${name}.png` });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Horizontal overflow: " + name);
  };
  try {
    await page.goto(base + "/auth/sign-up");
    await page.getByLabel("Your name", { exact: true }).fill("Fixture QA");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .waitFor();
    uid = (
      await cloudAdmin(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
        "POST",
        { email: [email] },
      )
    ).users?.[0]?.localId;
    record("Live UI signup and Firestore profile");
    const auth = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${e.EXPO_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const a = await auth.json();
    if (!auth.ok) throw new Error("QA token could not be obtained.");
    token = a.idToken;
    for (let i = 0; i < 2; i++)
      await page
        .getByRole("button", { name: "Skip for now", exact: true })
        .click();
    await page
      .getByRole("button", {
        name: "Explore without adding clothes",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Meet your wardrobe", exact: true })
      .click();
    await page.getByText("Today, made easy", { exact: true }).waitFor();
    await page.goto(base + "/closet");
    await page.getByText("Your closet.", { exact: true }).waitFor();
    await shot("empty-closet");
    await page.goto(base + "/garment/new");
    await page
      .getByRole("button", { name: "Photo library", exact: true })
      .waitFor();
    await shot("add-garment");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Photo library", exact: true })
      .click();
    await (await chooser).setFiles("tests/fixtures/white-oversized-tshirt.jpg");
    await page
      .getByText("META RECOGNITION · REVIEW BEFORE SAVING", { exact: true })
      .waitFor();
    await expect(
      page.getByLabel("Garment name", { exact: true }),
    ).not.toHaveValue("");
    record("Fixture gallery, compression and real Meta recognition");
    await shot("analysis-review");
    await page
      .getByLabel("Garment name", { exact: true })
      .fill("Fixture cotton shirt, reviewed");
    await page
      .getByRole("button", { name: "Add to my wardrobe", exact: true })
      .click();
    await page.getByText("PRIVATE THUMBNAIL SYNCED", { exact: true }).waitFor();
    garmentId = new URL(page.url()).pathname.split("/").pop();
    record("Edited metadata saved and private thumbnail synced");
    await shot("saved-garment");
    await page.reload();
    await page.getByText("PRIVATE THUMBNAIL SYNCED", { exact: true }).waitFor();
    await page
      .getByLabel("Fixture cotton shirt, reviewed", { exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByLabel("Fixture cotton shirt, reviewed", { exact: true }),
    ).toBeVisible();
    record("Garment, session and retained thumbnail after reload");
    const sign = await fetch("http://127.0.0.1:3001/v1/images/sign", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ownerId: uid, garmentId }),
    });
    if (!sign.ok) throw new Error("Private image authorization failed.");
    const signed = await sign.json();
    if (!(await fetch(signed.signedUrl)).ok)
      throw new Error("Signed image retrieval failed.");
    record("Authenticated private image retrieval");
    // A valid user must still be denied another owner path.
    const denial = await fetch("http://127.0.0.1:3001/v1/images/sign", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ownerId: "different-owner", garmentId }),
    });
    if (denial.status !== 403)
      throw new Error("Cross-user image authorization did not reject.");
    record("Cross-user private image rejected");
    const { seedGarments } = await import("../src/mocks/seed.ts");
    const { encodeFields } = await import("../server/firestore.ts");
    for (const [index, source] of [
      seedGarments[2],
      seedGarments[3],
    ].entries()) {
      const g = {
        ...source,
        id: `qa-owned-${index}`,
        ownerId: uid,
        image: null,
      };
      await cloudAdmin(
        `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}/garments/${g.id}`,
        "PATCH",
        { fields: encodeFields(g) },
      );
    }
    await page.goto(base + "/settings");
    await page
      .getByRole("button", { name: "Refresh cloud data", exact: true })
      .click();
    await page.goto(base + "/outfit/build");
    await page
      .getByRole("button", { name: "Recommend with Meta", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save this look", exact: true })
      .waitFor();
    await shot("grounded-outfit");
    await page
      .getByLabel("Name your look", { exact: true })
      .fill("Fixture live look");
    await page
      .getByRole("button", { name: "Save this look", exact: true })
      .click();
    await page.getByText("Fixture live look", { exact: true }).waitFor();
    record("Live grounded outfit saved from actual owned garments");
    await page.goto(base + "/product/search");
    await page
      .getByLabel("Product or style", { exact: true })
      .fill("white oversized cotton t shirt");
    await page.getByLabel("Maximum price ($)", { exact: true }).fill("50");
    await page
      .getByRole("button", { name: "Search live listings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compare +", exact: true })
      .first()
      .waitFor();
    record("Real Shopping listings in app");
    await shot("shopping-results");
    await page
      .getByRole("button", { name: "Compare +", exact: true })
      .nth(0)
      .click();
    await page
      .getByRole("button", { name: "Compare +", exact: true })
      .nth(0)
      .click();
    await page.getByRole("button", { name: "Compare 2", exact: true }).click();
    await page.getByText("A considered comparison.", { exact: true }).waitFor();
    record("Live product comparison");
    await shot("comparison");
    await page.goto(base + "/settings/services");
    await page.getByText("Backend usage today", { exact: true }).waitFor();
    await shot("service-status");
    if (errors.length)
      throw new Error("Browser raised " + errors.length + " runtime errors.");
    record("No browser runtime errors");
  } catch (error) {
    await shot("failure");
    console.error(
      String(error.message)
        .replace(/https?:\/\/[^\s]+/g, "[URL]")
        .slice(0, 1300),
    );
    throw error;
  } finally {
    if (uid && token && garmentId) {
      const r = await fetch("http://127.0.0.1:3001/v1/images/thumbnail", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ garmentId }),
      });
      console.log("Temporary UI thumbnail cleanup:", r.ok ? "PASS" : "FAIL");
    }
    await browser.close();
    if (uid) {
      await cleanup(uid);
      console.log("Disposable UI account and records removed.");
    }
    mkdirSync("docs", { recursive: true });
    writeFileSync(
      "docs/phase2-ui-results.json",
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          checks: results,
          cameraTested: false,
        },
        null,
        2,
      ) + "\n",
    );
  }
}
main().catch(() => {
  console.error(
    "Phase 2 UI verification failed; inspect the captured UI and service status. No credentials were printed.",
  );
  process.exitCode = 1;
});
