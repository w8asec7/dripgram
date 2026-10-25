/** Deterministic web visual QA. Offline samples, no camera/providers/credentials. */
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const output = ".private-cache/ux-responsive";
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true }),
    page = await browser.newPage();
  const errors = [],
    report = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("http://localhost:8081/");
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
    // Explicit local-only sample posts make the Profile grid measurable without publishing anything.
    await page.evaluate(() =>
      localStorage.setItem(
        "thread.posts.v1.demo",
        JSON.stringify({
          posts: Array.from({ length: 6 }, (_, i) => ({
            id: `responsive-qa-${i}`,
            ownerId: "demo",
            kind: "outfit",
            caption: "Sample responsive QA photograph",
            visibility: "friends",
            image: {
              uri: ["look-everyday", "look-basics", "look-hoodie"][i % 3],
              path: null,
              version: "responsive-fixture",
            },
            pieces: [],
            outfitId: null,
            createdAt: `2026-10-22T0${i}:00:00.000Z`,
            updatedAt: "2026-10-22T00:00:00.000Z",
            sample: true,
          })),
          likes: {},
          saved: [],
          comments: {},
        }),
      ),
    );
    const shot = async (name) => {
      await page.waitForTimeout(300);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error(`Overflow: ${name}`);
      await page.screenshot({ path: `${output}/${name}.png` });
    };
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ["feed", "closet", "discover", "profile"]) {
        await page.goto(`http://localhost:8081/${route}`);
        if (route === "discover")
          await page.getByText(/finds loaded/).waitFor();
        else if (route === "feed")
          await page
            .getByRole("button", { name: "Style Me", exact: true })
            .waitFor();
        else if (route === "closet")
          await page
            .getByLabel("Search your wardrobe", { exact: true })
            .waitFor();
        else
          await page
            .getByRole("button", { name: "My posts", exact: true })
            .waitFor();
        await shot(`${width}-${route}`);
        const selector =
          route === "discover"
            ? '[data-testid^="product-card-"]'
            : route === "closet"
              ? '[data-testid^="garment-card-"]'
              : route === "profile"
                ? '[aria-label^="Open post:"]'
                : null;
        const geometry = selector
          ? await page.locator(selector).evaluateAll((elements) => {
              const rows = elements
                .map((el) => el.getBoundingClientRect())
                .filter((r) => r.width > 0);
              const top = Math.min(...rows.map((r) => r.top));
              return rows
                .filter((r) => Math.abs(r.top - top) < 2)
                .map((r) => ({
                  left: Math.round(r.left),
                  right: Math.round(r.right),
                  width: Math.round(r.width),
                }));
            })
          : [];
        report.push({
          width,
          screen: route,
          firstRowColumns: geometry.length,
          geometry,
          overflow: false,
        });
      }
      await page.goto("http://localhost:8081/outfit/style");
      await page
        .getByRole("button", { name: "Wore This", exact: true })
        .waitFor();
      await shot(`${width}-style`);
      await page.goto(
        "http://localhost:8081/social/post/find-similar?postId=sample-post-1",
      );
      await page
        .getByRole("button", { name: "Find similar trousers", exact: true })
        .waitFor();
      await shot(`${width}-shop-look`);
    }
    await page.goto("http://localhost:8081/discover");
    const search = page.getByLabel("Search clothing", { exact: true });
    await search.fill("hoodie");
    await search.press("Enter");
    await expect(
      page.getByRole("button", { name: /hoodie/i }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Filter finds", exact: true })
      .click();
    await shot("1920-filters-keyboard");
    await page.goto("http://localhost:8081/discover");
    await page.getByText(/finds loaded/).waitFor();
    const list = page.getByTestId("shopping-feed");
    await list.hover();
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(200);
    const scroll = await list.evaluate((el) => el.scrollTop);
    if (scroll <= 0) throw Error("Desktop product scrolling failed");
    if (errors.length)
      throw Error("Runtime errors occurred during responsive QA");
    fs.writeFileSync(
      "docs/ux-responsive-results.json",
      JSON.stringify(
        {
          source:
            "Chromium Expo Web, offline fixture data, zero live provider calls",
          screenshots: 25,
          viewports: [375, 768, 1280, 1920],
          keyboardSearch: "PASS",
          mouseScrolling: "PASS",
          browserErrors: errors,
          layouts: report,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Responsive screenshots:25; runtime errors:0; keyboard search/mouse scroll:PASS`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
