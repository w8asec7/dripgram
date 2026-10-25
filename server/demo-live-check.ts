/** Explicit opt-in. recognition: one Meta call; feed: search only; default: both. Never activates a camera. */
import { chromium, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const { cloudAdmin } = createRequire(resolve("server/demo-live-check.ts"))(
  "../scripts/verify-cloud.cjs",
) as {
  cloudAdmin: (
    url: string,
    method?: string,
    body?: unknown,
  ) => Promise<Record<string, unknown>>;
};
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw Error("Set THREAD_RUN_LIVE_QA=1 for live demo verification.");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  let guest = "";
  const started = Date.now();
  let latestProductCount = 0;
  let inference = 0,
    outfits = 0,
    searches = 0;
  page.on("request", (request) => {
    if (request.url().includes("/v1/")) {
      const token = request.headers().authorization?.slice(7);
      if (token) {
        try {
          guest = JSON.parse(
            Buffer.from(token.split(".")[1], "base64url").toString(),
          ).sub;
        } catch {
          /* No token contents are logged. */
        }
      }
    }
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/v1/ai/analyze")) inference++;
    if (response.url().endsWith("/v1/ai/outfit")) outfits++;
    if (response.url().endsWith("/v1/shopping/feed")) {
      searches++;
      void response
        .json()
        .then((r) => {
          latestProductCount += r.products?.length || 0;
        })
        .catch(() => undefined);
    }
  });
  try {
    await page.goto("http://localhost:8081/");
    await page
      .getByRole("button", { name: "Explore demo", exact: true })
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
    await page.getByText("Today, made easy", { exact: true }).waitFor();
    if (process.env.THREAD_DEMO_SMOKE !== "feed") {
      await page.goto("http://localhost:8081/garment/new");
      await page
        .getByLabel("Garment name", { exact: true })
        .fill("Live demo red shirt");
      const chooser = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Photo library", exact: true })
        .click();
      await (await chooser).setFiles("tests/fixtures/red-shirt.jpg");
      await page
        .getByText("META RECOGNITION · REVIEW BEFORE SAVING", { exact: true })
        .waitFor({ timeout: 60000 });
      await expect(
        page.getByLabel("Primary color", { exact: true }),
      ).toHaveValue(/red/i);
      await expect(
        page.getByLabel("Garment name", { exact: true }),
      ).toHaveValue("Live demo red shirt");
      await page
        .getByRole("button", { name: "Add to my wardrobe", exact: true })
        .click();
      await page.waitForURL((url) => !url.pathname.endsWith("/garment/new"));
      await page.reload();
      await expect(
        page
          .getByText("Live demo red shirt", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await page.screenshot({ path: "docs/screenshots/followup-demo-red.png" });
      console.log(
        "Live demo recognition / editable metadata / save / restart: PASS",
      );
      if (process.env.THREAD_DEMO_SMOKE === "recognition") {
        console.log(
          "Application requests:",
          JSON.stringify({
            recognition: inference,
            outfits,
            feedBatches: searches,
          }),
        );
        return;
      }
      await page.goto("http://localhost:8081/outfit/build");
      await page
        .getByRole("button", { name: "Recommend with Meta", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save this look", exact: true })
        .waitFor({ timeout: 60000 });
      await expect(
        page.getByText(
          "Meta AI · Grounded in your wardrobe · Always editable",
          {
            exact: true,
          },
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Save this look", exact: true })
        .click();
      await page.waitForURL(/\/outfit\/outfit-/);
      console.log("Live demo grounded Meta outfit / local save: PASS");
    }
    await page.goto("http://localhost:8081/discover");
    await expect(page.getByText(/\d+ finds loaded/)).toBeVisible({
      timeout: 60000,
    });
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.match(/(\d+) finds loaded/);
        return text && Number(text[1]) >= 60;
      },
      {},
      { timeout: 60000 },
    );
    const initial = Number(
      (await page.getByText(/\d+ finds loaded/).innerText()).match(/\d+/)?.[0],
    );
    assert.ok(initial >= 60);
    await page.screenshot({
      path: "docs/screenshots/followup-live-large-discover.png",
    });
    await page.locator('[data-testid="shopping-feed"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(() => latestProductCount, { timeout: 60000 })
      .toBeGreaterThan(initial);
    console.log("Live demo large discovery / automatic append: PASS");
    console.log(
      "Application requests:",
      JSON.stringify({
        recognition: inference,
        outfits,
        feedBatches: searches,
      }),
    );
  } catch (e) {
    await page.screenshot({ path: "docs/screenshots/followup-demo-error.png" });
    console.log(
      "Demo diagnostic:",
      new URL(page.url()).pathname,
      (await page.locator("body").innerText()).slice(-1400),
    );
    throw e;
  } finally {
    await browser.close();
    if (guest) {
      const project = "thread-hacktx-2026-rp";
      const lookup = (await cloudAdmin(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
        "POST",
        { localId: [guest] },
      )) as {
        users?: {
          email?: string;
          providerUserInfo?: unknown[];
          createdAt?: string;
        }[];
      };
      const account = lookup.users?.[0];
      if (
        !account ||
        account.email ||
        account.providerUserInfo?.length ||
        Number(account.createdAt) < started - 10000
      )
        throw Error("Refusing to clean a non-fixture anonymous account.");
      const db = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
      for (const kind of ["garments", "products"]) {
        const list = (await cloudAdmin(`${db}/users/${guest}/${kind}`)) as {
          documents?: { name: string }[];
        };
        for (const d of list.documents || [])
          await cloudAdmin(
            "https://firestore.googleapis.com/v1/" + d.name,
            "DELETE",
          );
      }
      await cloudAdmin(`${db}/users/${guest}`, "DELETE");
      await cloudAdmin(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`,
        "POST",
        { localId: guest },
      );
      console.log(
        "Only the newly created anonymous QA account and its projection removed.",
      );
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Live demo QA failed");
  process.exitCode = 1;
});
