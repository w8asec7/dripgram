// Browser-only visual QA. Never click camera capture or request camera permission.
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const out = path.join(process.cwd(), ".private-cache/social-first-visual");
  fs.mkdirSync(out, { recursive: true });
  async function shot(name) {
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`Horizontal overflow on ${name}`);
  }
  try {
    for (const [name, route] of [
      ["welcome", "/"],
      ["sign-in", "/auth/sign-in"],
      ["sign-up", "/auth/sign-up"],
      ["forgot-password", "/auth/forgot"],
    ]) {
      await page.goto("http://localhost:8081" + route);
      await page
        .getByRole("button", {
          name:
            name === "welcome"
              ? "Explore demo"
              : name === "forgot-password"
                ? "Send reset link"
                : name === "sign-up"
                  ? "Create account"
                  : "Sign in",
          exact: true,
        })
        .waitFor();
      await shot(name);
    }
    await page.goto("http://localhost:8081/");
    await page
      .getByRole("button", { name: "Offline sample demo", exact: true })
      .click();
    await shot("onboarding-style");
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    await shot("onboarding-shopping");
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    await shot("onboarding-first-piece");
    await page
      .getByRole("button", {
        name: "Explore without adding clothes",
        exact: true,
      })
      .click();
    await shot("onboarding-ready");
    await page
      .getByRole("button", { name: "Meet your wardrobe", exact: true })
      .click();
    await page.getByRole("button", { name: "Style Me", exact: true }).waitFor();
    const routes = [
      ["feed", "feed"],
      ["outfit/style", "style-me"],
      ["profile", "profile"],
      ["closet", "closet"],
      ["garment/new", "add-clothing"],
      ["garment/photo", "photo-review"],
      ["garment/bulk", "bulk-text"],
      ["garment/g1", "garment-detail"],
      ["outfit/build", "outfit-builder"],
      ["outfit/o1", "saved-outfit"],
      ["discover", "unified-shopping"],
      ["product/p3", "product-detail"],
      ["product/cart", "shopping-collection-empty"],
      ["feed", "social-feed"],
      ["social/post/new", "create-post"],
      ["social/post/sample-post-1", "post-detail"],
      ["social/post/remix?postId=sample-post-1", "closet-remix"],
      ["social/group/weekend", "group-chat"],
      ["settings/friends", "friends"],
      ["social/group/new", "new-conversation"],
      ["settings", "settings"],
      ["settings/edit-profile", "profile-edit"],
      ["settings/notifications", "updates"],
      ["occasion/week", "seven-day-planner"],
    ];
    for (const [route, name] of routes) {
      await page.goto("http://localhost:8081/" + route);
      await page.waitForTimeout(300);
      await shot(name);
    }
    await page.goto("http://localhost:8081/feed");
    await page.getByRole("button", { name: "Messages", exact: true }).click();
    await shot("social-messages");
    await page.goto("http://localhost:8081/profile");
    await shot("social-profile");
    await page.setViewportSize({ width: 320, height: 568 });
    for (const route of [
      "feed",
      "closet",
      "outfit/build",
      "discover",
      "social",
      "social/post/new",
      "social/post/remix?postId=sample-post-1",
      "social/group/weekend",
      "garment/bulk",
      "settings/edit-profile",
      "occasion/week",
    ]) {
      await page.goto("http://localhost:8081/" + route);
      await page.waitForTimeout(200);
      await shot("small-" + route.replaceAll("/", "-"));
    }
    await page.setViewportSize({ width: 430, height: 932 });
    for (const route of [
      "feed",
      "social",
      "discover",
      "social/group/weekend",
    ]) {
      await page.goto("http://localhost:8081/" + route);
      await page.waitForTimeout(300);
      await shot("large-" + route.replaceAll("/", "-").replaceAll("?", "-"));
    }
    console.log(
      `Captured ${4 + 4 + routes.length + 2 + 11 + 4} preview screenshots; horizontal overflow: none.`,
    );
    if (errors.length)
      throw new Error(
        "Browser runtime errors: " + JSON.stringify([...new Set(errors)]),
      );
    console.log("Browser runtime errors: none.");
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
