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
  await expect(
    page.getByRole("button", { name: "Style Me", exact: true }),
  ).toBeVisible();
}
test("launch keeps login/demo choice; Feed lands first and Closet has no retired controls", async ({
  page,
}) => {
  await demo(page);
  await expect(
    page.getByText("YOUR DAILY CHECK-IN", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/closet");
  await expect(
    page.getByRole("button", { name: "Tops", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Washed", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Essentials", exact: true }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(page).toHaveURL(/\/feed$/);
  await expect(
    page.getByRole("button", { name: "Style Me", exact: true }),
  ).toBeVisible();
});
test("closet filtering, manual CRUD and no-photo fallback persist", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/closet");
  await page.getByRole("button", { name: "Bottoms", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cloud cotton tee", exact: true }),
  ).toHaveCount(0);
  await page.goto("/garment/photo");
  await page
    .getByLabel("Garment name", { exact: true })
    .fill("Text-only red shirt");
  await page
    .getByRole("button", { name: "Add to my wardrobe", exact: true })
    .click();
  await expect(
    page.getByText("Text-only red shirt", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Text-only red shirt", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit piece", exact: true }).click();
  await page.getByLabel("Primary color", { exact: true }).fill("red");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete garment", exact: true })
    .click();
  await expect(page).toHaveURL(/\/closet$/);
});
test("bulk text extracts multiple pieces, allows corrections and saves only selected entries", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/garment/bulk");
  await page
    .getByLabel("Describe your clothing", { exact: true })
    .fill(
      "Red oversized T-shirt, grey oversized T-shirt, blue baggy jeans, white sneakers, and a Polo Ralph Lauren shirt with a bear print",
    );
  await page
    .getByRole("button", { name: "Find my garments", exact: true })
    .click();
  await expect(page.getByLabel("Name 5", { exact: true })).toBeVisible();
  await page.getByLabel("Name 1", { exact: true }).fill("My red oversized tee");
  await page
    .getByRole("button", { name: "Save 5 selected pieces", exact: true })
    .click();
  await expect(page).toHaveURL(/\/closet$/);
  await page
    .getByLabel("Search your wardrobe", { exact: true })
    .fill("My red oversized tee");
  await expect(
    page.getByRole("button", { name: "My red oversized tee", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByLabel("Search your wardrobe", { exact: true })
    .fill("My red oversized tee");
  await expect(
    page.getByRole("button", { name: "My red oversized tee", exact: true }),
  ).toBeVisible();
});
test("outfit generation replaces and saves actual clothing without wear workflow", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/outfit/build");
  await page
    .getByRole("button", { name: "Replace", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Choose/ })
    .first()
    .click();
  await page
    .getByLabel("Name your look", { exact: true })
    .fill("My two-piece edit");
  await page
    .getByRole("button", { name: "Save this look", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.goto("/outfit/saved");
  await expect(
    page.getByText("My two-piece edit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Wear Selected Items", exact: true }),
  ).toHaveCount(0);
});
test("social feed has clear sample provenance, pagination and zero automatic AI/shopping calls", async ({
  page,
}) => {
  await demo(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/v1\/(ai|shopping)/.test(r.url())) calls.push(r.url());
  });
  await page.goto("/feed");
  await expect(
    page.getByRole("button", { name: "Style Me", exact: true }),
  ).toBeVisible();
  const feed = page.getByTestId("fashion-feed");
  await expect(
    page
      .getByRole("button", { name: "Remix With My Closet", exact: true })
      .first(),
  ).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await feed.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const more = page.getByRole("button", {
      name: "More inspiration",
      exact: true,
    });
    if (await more.isVisible()) {
      await more.click();
      break;
    }
  }
  await feed.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    page.getByText("You’re caught up. Pull down to refresh.", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});
test("saved-outfit posting, likes, comments, bookmarks and restart persistence", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/social/post/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (await chooser).setFiles("assets/photography/look-casual.jpg");
  await expect(
    page.getByLabel("Post photo preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose photo", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Link saved outfit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close saved outfits", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /A little everyday ease/ }).click();
  await page
    .getByLabel("Caption", { exact: true })
    .fill("My weekend inspiration");
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await expect(page).toHaveURL(/\/social\/post\/post-/);
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await page
    .getByLabel("Add a comment", { exact: true })
    .fill("Trying a different layer next time.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Trying a different layer next time.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unsave post", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await page
    .getByRole("button", {
      name: "Open post: My weekend inspiration",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/social\/post\/post-/);
  await expect(
    page.getByText("Trying a different layer next time.", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete my post", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
});
test("photo-only post uses a controlled image without requiring catalogued garments", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/social/post/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (await chooser).setFiles("assets/photography/tee-rose.jpg");
  await expect(
    page.getByLabel("Post photo preview", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Caption", { exact: true })
    .fill("A photo-first outfit");
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await expect(page.getByText(/A photo-first outfit/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Outfit photo", { exact: true }).first(),
  ).toBeVisible();
});
test("remix is grounded, saves a look and transfers search context into unified Discover", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/feed");
  await page
    .getByRole("button", { name: "Remix With My Closet", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("RULE-BASED SAMPLE REMIX", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Oxford blue shirt", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Shop similar pieces", exact: true })
    .click();
  await expect(page).toHaveURL(/\/social\/post\/shop-results\?.*postId=/);
  await expect(
    page.getByLabel("Search clothing", { exact: true }),
  ).not.toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Back to inspiration", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/social\/post\/remix\?postId=/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
});
test("missing category produces honest shopping action and retains post reference", async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("thread.demo.v1")!);
    d.garments = d.garments.filter(
      (g: { category: string }) =>
        !["jeans", "trousers", "shorts", "other-bottom"].includes(g.category),
    );
    localStorage.setItem("thread.demo.v1", JSON.stringify(d));
  });
  await page.goto("/social/post/remix?postId=sample-post-1");
  await expect(
    page.getByRole("button", { name: "Shop missing piece", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Shop missing piece", exact: true })
    .click();
  await expect(page.getByLabel("Search clothing", { exact: true })).toHaveValue(
    /beige.*trousers/,
  );
});
test("post sharing creates a private DM, preview opens original and no inventory records change", async ({
  page,
}) => {
  await demo(page);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thread.demo.v1")!).wears,
  );
  await page.goto("/social/post/share?postId=sample-post-1");
  await page
    .getByRole("button", { name: "Send to Maya Chen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/social\/group\/dm-/);
  await expect(
    page.getByText("Shared outfit post", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Message", { exact: true })
    .fill("This is the direction I’m thinking.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("This is the direction I’m thinking.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("thread.demo.v1")!).wears,
    ),
  ).toEqual(before);
});
test("unified shopping is long, refreshable and cart data survives restart", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/discover");
  await expect(page.getByText(/finds loaded · Last checked/)).toBeVisible();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: /Shopping collection, 1 items/ })
    .click();
  await expect(
    page.getByText("Your shopping collection.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Find Something That Matches", exact: true })
    .click();
  await expect(
    page.getByText("SAMPLE CATEGORY SUGGESTIONS", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove from collection", exact: true })
    .click();
  await expect(
    page.getByText("Keep your good finds together.", { exact: true }),
  ).toBeVisible();
  await page.goto("/discover");
  await page.getByRole("button", { name: "Refresh feed", exact: true }).click();
  await expect(page.getByText(/finds loaded · Last checked/)).toBeVisible();
});
test("native-compatible chat attachments and local text persist without obsolete inventory actions", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/social/group/new");
  await page
    .getByLabel("Group name", { exact: true })
    .fill("Friday Dinner Fits");
  await page.getByRole("button", { name: "Maya Chen", exact: true }).click();
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page
    .getByRole("button", { name: "Add outfit attachment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select From My Closet", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Cloud cotton tee", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Sand pleated trousers", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Attach 2 pieces", exact: true })
    .click();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("My outfit idea", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Add outfit attachment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create AI Outfit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Share outfit in chat", exact: true })
    .click();
  await expect(page).toHaveURL(/\/social\/group\//);
});
test("profile bio and shopping preference persist; legacy management routes redirect safely", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/settings/edit-profile");
  await page
    .getByLabel("Bio", { exact: true })
    .fill("Neutral colors, oversized fits.");
  await page.getByRole("button", { name: "Women’s", exact: true }).click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.goto("/settings/edit-profile");
  await expect(page.getByLabel("Bio", { exact: true })).toHaveValue(
    "Neutral colors, oversized fits.",
  );
  await expect(
    page.getByRole("button", { name: "Women’s", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/settings/laundry");
  await expect(page).toHaveURL(/\/closet$/);
  await page.goto("/occasion/week");
  await expect(
    page.getByText("Your week, well dressed.", { exact: true }),
  ).toBeVisible();
});

test("Feed has real photographs, Style Me responds immediately, Profile houses planner and clothing posts find similar", async ({
  page,
}) => {
  await demo(page);
  await expect(page).toHaveURL(/\/feed$/);
  await expect(
    page.getByRole("button", { name: "Messages", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Style Me", exact: true }).click();
  await expect(page.getByText("Your next look", { exact: true })).toBeVisible();
  const initial = await page
    .getByText("Casual day, your way", { exact: true })
    .textContent();
  await page
    .getByRole("button", { name: "Try another outfit", exact: true })
    .click();
  await expect(page.getByText(initial!, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(
    page.getByText("Dinner, your way", { exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: "Saved outfits", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Seven-day planner", exact: true })
    .click();
  await expect(page).toHaveURL(/\/occasion\/week$/);
  await page.goto("/social/post/new");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (await chooser).setFiles("assets/photography/tee-black.jpg");
  await page.getByRole("button", { name: "Clothing", exact: true }).click();
  await page.getByLabel("Caption", { exact: true }).fill("One black tee.");
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Find Similar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remix With My Closet", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Find Similar", exact: true }).click();
  await expect(page).toHaveURL(/find-similar/);
  await expect(
    page.getByText(/Photo understanding needs live Meta services/),
  ).toBeVisible();
  await page.goto("/social/post/find-similar?postId=sample-post-9");
  await page
    .getByRole("button", { name: "Find similar t-shirt", exact: true })
    .click();
  await expect(page).toHaveURL(/shop-results\?.*postId=sample-post-9/);
  await expect(page.getByLabel("Search clothing", { exact: true })).toHaveValue(
    /black.*t-shirt/,
  );
});

test("Build a Look anchors the selected garment and completing it returns directly to Closet", async ({
  page,
}) => {
  await demo(page);
  for (const id of ["g1", "g3", "g4"]) {
    await page.goto(`/garment/${id}`);
    const before = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("thread.demo.v1"))) ||
        "{}",
    );
    const selected = before.garments.find((g: { id: string }) => g.id === id);
    await page
      .getByRole("button", { name: "Build a look", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`requiredGarmentId=${id}`));
    await expect(page.getByTestId("required-garment-name")).toHaveText(
      selected.name,
    );
    await page
      .getByLabel("Name your look", { exact: true })
      .fill(`Anchored ${id}`);
    await page
      .getByRole("button", { name: "Save this look", exact: true })
      .click();
    await expect(page).toHaveURL(/\/closet$/);
    const outfits = await page.evaluate(
      () => JSON.parse(localStorage.getItem("thread.demo.v1")!).outfits,
    );
    expect(
      outfits
        .find((o: { name: string }) => o.name === `Anchored ${id}`)
        .items.some((i: { garmentId: string }) => i.garmentId === id),
    ).toBe(true);
  }
});
test("post comments focus in place and profile uses compact navigable thumbnails", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Comment on post", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/social\/post\/sample-post-/);
  await expect(page.getByLabel("Add a comment", { exact: true })).toBeVisible();
  const url = page.url();
  await page
    .getByRole("button", { name: "Comment on post", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  await expect(page.getByLabel("Add a comment", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.goto("/profile");
  await expect(page.getByText("Rishi Nigam", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Saved posts", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start a conversation", exact: true }),
  ).toHaveCount(0);
});

test("compact advanced filters validate price ranges and recover from empty results", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/discover");
  await page.getByRole("button", { name: "Filter finds", exact: true }).click();
  await page.getByLabel("Minimum price (USD)", { exact: true }).fill("30");
  await page.getByLabel("Maximum price (USD)", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Apply shopping filters", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid price range.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Minimum price (USD)", { exact: true }).fill("0");
  await page.getByLabel("Maximum price (USD)", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Apply shopping filters", exact: true })
    .click();
  await expect(
    page.getByText("No matching finds in this selection.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filter finds", exact: true }).click();
  await page.getByRole("button", { name: "Shoes", exact: true }).click();
  await page.getByLabel("Maximum price (USD)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Apply shopping filters", exact: true })
    .click();
  await expect(
    page.getByText("No matching finds in this selection.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/finds loaded · Last checked/)).toBeVisible();
  await page.getByRole("button", { name: "On sale", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "On sale ✓", exact: true }),
  ).toBeVisible();
});
