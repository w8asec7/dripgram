import { seedData } from "../../src/mocks/seed";
import { photoDemoPosts } from "../../src/mocks/fashionPosts";
import {
  compareLookToCloset,
  pieceSearchQuery,
} from "../../src/features/shopping/lookComparison";
import { lookPieces } from "../../src/features/shopping/lookAnalysis";
import { gridMetrics } from "../../src/theme/responsive";
test("wardrobe-aware shopping favors owned equivalents and highlights a genuine missing category", () => {
  const data = seedData(),
    pieces = photoDemoPosts(data)[0].pieces;
  const rows = compareLookToCloset(
    pieces,
    data.garments.filter(
      (g) => !["trousers", "jeans", "shorts"].includes(g.category),
    ),
    "demo",
  );
  expect(rows[0].status).toBe("owned");
  expect(rows[0].reason).toMatch(/already own/);
  expect(rows[1].status).toBe("missing");
  expect(rows[1].recommended).toBe(true);
  expect(rows[1].query).toMatch(/beige.*trousers/);
});
test("wrong colors, unknown attributes, unrelated layers and foreign clothes do not become confident ownership matches", () => {
  const d = seedData(),
    piece = photoDemoPosts(d)[0].pieces[0];
  expect(
    compareLookToCloset(
      [piece],
      d.garments.map((g) => ({ ...g, ownerId: "other" })),
      "demo",
    )[0].status,
  ).toBe("missing");
  expect(
    compareLookToCloset(
      [piece],
      d.garments.filter((g) => g.category === "jacket"),
      "demo",
    )[0].status,
  ).toBe("missing");
  expect(
    compareLookToCloset(
      [{ ...piece, primaryColor: "unknown" }],
      d.garments,
      "demo",
    )[0].status,
  ).toBe("review");
  const pants = photoDemoPosts(d)[0].pieces[1];
  expect(
    compareLookToCloset(
      [pants],
      d.garments.filter((g) => g.category === "shorts"),
      "demo",
    )[0].status,
  ).toBe("missing");
  expect(
    compareLookToCloset(
      [piece],
      [{ ...d.garments[0], primaryColor: "black" }],
      "demo",
    )[0].status,
  ).toBe("different");
});
test("search context preserves observed attributes without literal unknowns or invented brands", () => {
  const p = photoDemoPosts(seedData())[0].pieces[0];
  expect(
    pieceSearchQuery({
      ...p,
      primaryColor: "white",
      fit: "oversized",
      subcategory: "shirt",
    }),
  ).toBe("white oversized shirt");
  expect(
    pieceSearchQuery({ ...p, primaryColor: "unknown", fit: "unknown" }),
  ).not.toMatch(/unknown/);
});
test("post understanding deduplicates simultaneous requests and cache separates source versions and users", async () => {
  const post = photoDemoPosts(seedData())[0],
    loader = jest.fn(async () => ({ original: { pieces: post.pieces } }));
  await Promise.all([
    lookPieces("cache-user", "sample", post, loader),
    lookPieces("cache-user", "sample", post, loader),
  ]);
  expect(loader).toHaveBeenCalledTimes(1);
  await lookPieces("cache-user", "sample", post, loader);
  expect(loader).toHaveBeenCalledTimes(1);
  await lookPieces(
    "cache-user",
    "sample",
    { ...post, image: { ...post.image!, version: "changed" } },
    loader,
  );
  await lookPieces("other-cache-user", "sample", post, loader);
  expect(loader).toHaveBeenCalledTimes(3);
});
test("Discover uses compact adaptive columns and respects maximum width at all target sizes", () => {
  const widths = [375, 768, 1280, 1920];
  expect(widths.map((w) => gridMetrics(w, "discover", true).columns)).toEqual([
    2, 3, 5, 6,
  ]);
  widths.forEach((w) => {
    const g = gridMetrics(w, "discover", true);
    expect(g.cardWidth).toBeGreaterThan(140);
    expect(g.cardWidth).toBeLessThan(260);
  });
  expect(gridMetrics(375, "profile", true).columns).toBe(3);
  expect(gridMetrics(1920, "profile", true).columns).toBe(6);
  expect(gridMetrics(1920, "closet", true).columns).toBe(6);
  expect(gridMetrics(375, "discover", false).columns).toBe(2);
});
