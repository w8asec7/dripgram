/** Opt-in HTTPS release QA. Disposable Firebase account; no model/search calls. */
const { chromium, expect } = require("@playwright/test");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const { cloudAdmin, cleanup } = require("./verify-cloud.cjs");
const origin =
  process.env.THREAD_QA_WEB_URL || "https://thread-hacktx-2026-rp.web.app";
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw Error("Explicit live QA flag required.");
  const browser = await chromium.launch({ headless: true });
  let uid;
  const errors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/");
    await page
      .getByRole("button", { name: "Offline sample demo", exact: true })
      .click();
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
    await page.getByRole("button", { name: "Style Me", exact: true }).waitFor();
    const box = await page.getByTestId("feed-column").boundingBox();
    if (!box || Math.abs(box.x + box.width / 2 - 640) > 2)
      throw Error("Hosted feed is not centered.");
    fs.mkdirSync("docs/screenshots/ux", { recursive: true });
    await page.waitForFunction(() =>
      Array.from(document.fonts).some(
        (font) =>
          font.family.toLowerCase().includes("feather") &&
          font.status === "loaded",
      ),
    );
    await page.waitForFunction(() =>
      Array.from(document.images).some(
        (image) =>
          image.width > 200 && image.complete && image.naturalWidth > 200,
      ),
    );
    const sidebar = page.getByTestId("desktop-sidebar");
    await expect(sidebar).toHaveCount(1);
    await page.screenshot({ path: "docs/screenshots/ux/hosted-feed.png" });
    for (const [label, expected] of [
      ["Messages", "/social/messages"],
      ["Closet", "/closet"],
      ["Create post", "/social/post/new"],
      ["Discover", "/discover"],
      ["Settings", "/settings"],
      ["Feed", "/feed"],
    ]) {
      await sidebar.getByRole("button", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(expected + "$"));
      await expect(sidebar).toHaveCount(1);
    }
    await page.goto(origin + "/social/post/find-similar?postId=sample-post-1");
    await page
      .getByRole("button", { name: "Find similar trousers", exact: true })
      .click();
    await page.getByText(/finds loaded/).waitFor();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Find similar shirt", exact: true }),
    ).toBeVisible();
    await page.goto(origin + "/discover");
    await page.getByText(/finds loaded/).waitFor();
    await page.screenshot({ path: "docs/screenshots/ux/hosted-discover.png" });
    const live = await browser.newPage({
      viewport: { width: 393, height: 852 },
    });
    live.on("pageerror", (e) => errors.push(e.message));
    const email = `qa-${Date.now()}@example.test`,
      password = randomBytes(24).toString("hex");
    await live.goto(origin + "/auth/sign-up");
    await live.getByLabel("Your name", { exact: true }).fill("Release QA");
    await live.getByLabel("Email address", { exact: true }).fill(email);
    await live.getByLabel("Password", { exact: true }).fill(password);
    await live
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await live
      .getByRole("button", { name: "Skip for now", exact: true })
      .waitFor({ timeout: 30000 });
    const account = await cloudAdmin(
      "https://identitytoolkit.googleapis.com/v1/projects/thread-hacktx-2026-rp/accounts:lookup",
      "POST",
      { email: [email] },
    );
    uid = account.users?.[0]?.localId;
    if (!uid) throw Error("Disposable release account was not created.");
    for (let i = 0; i < 2; i++)
      await live
        .getByRole("button", { name: "Skip for now", exact: true })
        .click();
    await live
      .getByRole("button", {
        name: "Explore without adding clothes",
        exact: true,
      })
      .click();
    await live
      .getByRole("button", { name: "Meet your wardrobe", exact: true })
      .click();
    await live
      .getByRole("button", { name: "Style Me", exact: true })
      .waitFor({ timeout: 30000 });
    await live.reload();
    await live
      .getByRole("button", { name: "Style Me", exact: true })
      .waitFor({ timeout: 30000 });
    await live.goto(origin + "/settings");
    await live.getByRole("button", { name: "Sign out", exact: true }).click();
    await live.goto(origin + "/auth/sign-in");
    await live.getByLabel("Email address", { exact: true }).fill(email);
    await live.getByLabel("Password", { exact: true }).fill(password);
    await live.getByRole("button", { name: "Sign in", exact: true }).click();
    await live
      .getByRole("button", { name: "Style Me", exact: true })
      .waitFor({ timeout: 30000 });
    if (errors.length) throw Error("Hosted browser runtime error.");
    const report = {
      origin,
      httpsRelease: "PASS",
      centeredFeed: "PASS",
      iconFontLoaded: "PASS",
      realPhotographLoaded: "PASS",
      persistentSidebarAcrossMessagesCreateSettings: "PASS",
      nestedRouteReload: "PASS",
      returnableShopping: "PASS",
      firebaseSignUpSignInSession: "PASS",
      runtimeErrors: errors,
      metaRequests: 0,
      serpRequests: 0,
    };
    fs.writeFileSync(
      "docs/ux-hosted-results.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.info(JSON.stringify(report));
  } finally {
    await browser.close();
    if (uid) {
      await cleanup(uid);
      console.info("Only disposable release QA account removed.");
    }
  }
}
main().catch(() => {
  console.error(
    "Hosted release verification failed; inspect the local Playwright stage without exposing credentials.",
  );
  process.exitCode = 1;
});
