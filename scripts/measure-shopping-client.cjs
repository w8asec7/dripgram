/** Browser rendering/bundled-photo benchmark; offline fixtures, zero provider credits. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  try {
    await page.goto("http://127.0.0.1:8081");
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
    await page.goto("http://127.0.0.1:8081/discover");
    await page.getByText(/finds loaded · Last checked/).waitFor();
    await page.waitForFunction(() =>
      globalThis
        .__dripgramShoppingTimings?.()
        .some((m) => m.phase === "product_image"),
    );
    const measurements = await page.evaluate(() =>
      globalThis.__dripgramShoppingTimings(),
    );
    const report = {
      source:
        "393x852 Chromium offline fixture rendering, not live SerpApi latency",
      providerCalls: 0,
      measurements,
    };
    fs.writeFileSync(
      ".private-cache/polish-client-timings.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
