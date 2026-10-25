import { test, expect, Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/");
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
}
test("only comment icon remains and Style Me saves/records/change/undo feedback without changing inventory", async ({
  page,
}) => {
  await demo(page);
  await expect(
    page.getByRole("button", { name: "View comments", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start a conversation", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Comment on post", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Add a comment", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Style Me", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "More styling options", exact: true }),
  ).toHaveCount(0);
  const before = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("thread.demo.v1")!);
    return { garments: d.garments, wears: d.wears, essentials: d.essentials };
  });
  await page.getByRole("button", { name: "Save outfit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved outfit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/outfit\/style$/);
  await page.getByRole("button", { name: "Wore This", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo Wore This", exact: true }),
  ).toBeVisible();
  const first = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thread.demo.v1")!).outfitFeedback,
  );
  expect(first).toHaveLength(1);
  expect(first[0].response).toBe("wore");
  await page
    .getByRole("button", { name: "Didn't Wear This", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo Didn't Wear This", exact: true }),
  ).toBeVisible();
  const changed = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thread.demo.v1")!).outfitFeedback,
  );
  expect(changed).toHaveLength(1);
  expect(changed[0].id).toBe(first[0].id);
  expect(changed[0].response).toBe("did-not-wear");
  await page.goto(`/outfit/${first[0].outfitId}`);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Undo Didn't Wear This", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Undo Didn't Wear This", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Didn't Wear This", exact: true }),
  ).toBeVisible();
  const after = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("thread.demo.v1")!);
    return {
      garments: d.garments,
      wears: d.wears,
      essentials: d.essentials,
      feedback: d.outfitFeedback,
    };
  });
  expect(after.feedback).toEqual([]);
  expect({
    garments: after.garments,
    wears: after.wears,
    essentials: after.essentials,
  }).toEqual(before);
});
test("bookmark and share remain available as compact accessible icons", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Style Me", exact: true }).click();
  await page.getByRole("button", { name: "Share outfit", exact: true }).click();
  await expect(page).toHaveURL(/social\/post\/new\?outfitId=/);
  await expect(
    page.getByRole("button", { name: "Choose photo", exact: true }),
  ).toBeVisible();
});
test("Shop the Look retains breakdown across multiple product searches and independent Discover stays independent", async ({
  page,
}) => {
  await demo(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/v1\/(posts\/analyze|ai\/remix)/.test(r.url())) calls.push(r.url());
  });
  // Make a known missing category without adding any fabricated wear events.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("thread.demo.v1")!);
    d.garments = d.garments.filter(
      (g: { category: string }) =>
        !["jeans", "trousers", "shorts"].includes(g.category),
    );
    localStorage.setItem("thread.demo.v1", JSON.stringify(d));
  });
  await page.goto("/social/post/sample-post-1");
  await page
    .getByRole("button", { name: "Shop This Look", exact: true })
    .click();
  await expect(
    page.getByText("HIGHEST-PRIORITY ADDITION", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/You already own a similar piece/)).toBeVisible();
  await page
    .getByRole("button", { name: "Find similar trousers", exact: true })
    .click();
  await expect(page.getByLabel("Search clothing", { exact: true })).toHaveValue(
    /beige.*trousers/,
  );
  await expect(
    page.getByRole("button", { name: "Back to inspiration", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/find-similar\?postId=sample-post-1/);
  await expect(
    page.getByText("HIGHEST-PRIORITY ADDITION", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Find similar shirt", exact: true })
    .click();
  await expect(page.getByLabel("Search clothing", { exact: true })).toHaveValue(
    /white.*shirt/,
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Find similar shirt", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/social\/post\/sample-post-1$/);
  await page.goto("/discover");
  await expect(page.getByLabel("Search clothing", { exact: true })).toHaveValue(
    "",
  );
  expect(calls).toEqual([]);
});
for (const width of [375, 768, 1100, 1280, 1920])
  test(`responsive Discover/Closet/Profile/Feed at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await demo(page);
    await page.goto("/discover");
    await expect(page.getByText(/finds loaded/)).toBeVisible();
    const geometry = await page
      .locator('[data-testid^="product-card-"]')
      .evaluateAll((elements) => {
        const b = elements
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const top = Math.min(...b.map((r) => r.top));
        return b
          .filter((r) => Math.abs(r.top - top) < 3)
          .map((r) => ({ width: r.width, left: r.left, right: r.right }));
      });
    expect(geometry).toHaveLength(
      width === 375
        ? 2
        : width === 768
          ? 3
          : width === 1100
            ? 4
            : width === 1280
              ? 5
              : 6,
    );
    expect(
      geometry.every(
        (r) => r.width > 140 && r.width < 260 && r.right <= width + 1,
      ),
    ).toBe(true);
    for (const route of ["/feed", "/closet", "/profile"]) {
      await page.goto(route);
      if (route === "/feed") {
        const feed = page.getByTestId("feed-column");
        await expect(feed).toBeVisible();
        const bounds = await feed.boundingBox();
        expect(bounds).not.toBeNull();
        expect(
          Math.abs(bounds!.x + bounds!.width / 2 - width / 2),
        ).toBeLessThan(2);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });

test("desktop sidebar stays available through messages, create post and settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await demo(page);
  const sidebar = page.getByTestId("desktop-sidebar");
  for (const [label, route] of [
    ["Messages", "/social/messages"],
    ["Closet", "/closet"],
    ["Create post", "/social/post/new"],
    ["Discover", "/discover"],
    ["Settings", "/settings"],
    ["Feed", "/feed"],
  ]) {
    await sidebar.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(sidebar).toHaveCount(1);
  }
  await page.waitForFunction(() =>
    Array.from(document.fonts).some(
      (font) =>
        font.family.toLowerCase().includes("feather") &&
        font.status === "loaded",
    ),
  );
});
