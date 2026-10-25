import { normalizeClothingObservation } from "../../shared/clothing";
import { seedData, products } from "../../src/mocks/seed";
import { AppDataSchema, isoNow } from "../../src/models";
import { generateOutfit } from "../../src/services/ai";
import { applyCommand } from "../../src/repositories/domain";
import {
  extractOffline,
  garmentFromDescription,
} from "../../src/features/wardrobe/text";
import {
  sampleRemix,
  validateRemix,
  postPiece,
} from "../../src/features/feed/domain";
import { interleaveProducts, uniqueProducts } from "../../shared/feed";
test("legacy inventory survives schema migration while all owned pieces remain eligible for styling", () => {
  const data = seedData();
  const legacy = { ...data, cart: undefined };
  expect(AppDataSchema.parse(legacy).cart).toEqual([]);
  const clothes = data.garments
    .filter((g) => g.ownerId === "demo")
    .map((g) => ({ ...g, availability: "laundry" as const }));
  const result = generateOutfit({
    ownerId: "demo",
    garments: clothes,
    preferences: data.profile.preferences,
    occasionType: "Casual day",
  });
  expect(result.outfit?.items).toHaveLength(2);
  expect(clothes.every((g) => g.availability === "laundry")).toBe(true);
});
test("bulk text extraction splits five literal garments without invented brands", () => {
  const result = extractOffline(
    "Red oversized T-shirt, grey oversized T-shirt, blue baggy jeans, white sneakers, and a Polo Ralph Lauren shirt with a bear print",
  );
  expect(result.garments).toHaveLength(5);
  expect(result.garments.map((g) => g.primaryColor)).toEqual([
    "red",
    "grey",
    "blue",
    "white",
    "unknown",
  ]);
  expect(result.garments[4].brand).toBe("Polo Ralph Lauren");
  expect(result.garments.slice(0, 4).every((g) => g.brand === null)).toBe(true);
});
test("bulk garment save is atomic, repeatable and preserves existing photos/history", () => {
  const data = seedData(),
    garments = extractOffline("red shirt, blue jeans").garments.map((p) =>
      garmentFromDescription(p, "demo", "M"),
    );
  const once = applyCommand(data, "demo", { type: "garment.bulk", garments });
  const twice = applyCommand(once, "demo", { type: "garment.bulk", garments });
  expect(twice.garments.length).toBe(data.garments.length + 2);
  expect(twice.wears).toEqual(data.wears);
  expect(twice.garments.find((g) => g.id === "g1")?.image).toEqual(
    data.garments[0].image,
  );
  expect(() =>
    applyCommand(data, "demo", {
      type: "garment.bulk",
      garments: [garments[0], { ...garments[1], ownerId: "outsider" }],
    }),
  ).toThrow();
  expect(data.garments).not.toContainEqual(garments[0]);
});
test("remix accepts actual owned legacy garments and rejects unknown, foreign, duplicate and wrong-category IDs", () => {
  const data = seedData(),
    original = [postPiece(data.garments[0]), postPiece(data.garments[2])],
    result = sampleRemix(original, data.garments, "demo", "post");
  expect(result.matches).toHaveLength(2);
  expect(() =>
    validateRemix(
      {
        ...result,
        matches: [
          { ...result.matches[0], garmentId: "invented" },
          result.matches[1],
        ],
      },
      data.garments,
      "demo",
    ),
  ).toThrow();
  expect(() =>
    validateRemix(
      {
        ...result,
        matches: [
          result.matches[0],
          { ...result.matches[1], garmentId: result.matches[0].garmentId },
        ],
      },
      data.garments,
      "demo",
    ),
  ).toThrow();
  expect(() => validateRemix(result, data.garments, "other")).toThrow();
  const missing = sampleRemix(
    original,
    data.garments.filter((g) => g.category === "t-shirt"),
    "demo",
    "post",
  );
  expect(missing.missing).toHaveLength(1);
});
test("cart add/remove persists actual metadata with stable product IDs; no ownership confusion", () => {
  const data = seedData(),
    product = products[0];
  const added = applyCommand(data, "demo", {
    type: "cart.add",
    item: { id: product.id, ownerId: "demo", product, createdAt: isoNow() },
  });
  expect(added.cart[0].product).toEqual(product);
  expect(added.garments).toEqual(data.garments);
  expect(
    applyCommand(added, "demo", { type: "cart.remove", id: product.id }).cart,
  ).toEqual([]);
  expect(() =>
    applyCommand(data, "demo", {
      type: "cart.add",
      item: { id: product.id, ownerId: "other", product, createdAt: isoNow() },
    }),
  ).toThrow();
});
test("new shopping batches interleave relevant categories and deduplicate real listings", () => {
  const values = [
    { category: "trousers", id: 1 },
    { category: "trousers", id: 2 },
    { category: "shirt", id: 3 },
    { category: "shirt", id: 4 },
    { category: "shoes", id: 5 },
  ];
  expect(interleaveProducts(values).map((p) => p.id)).toEqual([1, 3, 5, 2, 4]);
  expect(
    uniqueProducts([
      { id: "a", providerId: "same", offer: { url: null, retailer: "A" } },
      { id: "b", providerId: "same", offer: { url: null, retailer: "B" } },
    ]),
  ).toHaveLength(1);
});

test("literal observations reconcile contradictory category fields without guessing unknown fit or brand", () => {
  expect(
    normalizeClothingObservation({
      name: "White button-up shirt",
      category: "t-shirt",
      fit: "unknown",
      brand: "unknown",
    }),
  ).toMatchObject({ category: "shirt", fit: "unknown", brand: null });
  expect(
    normalizeClothingObservation({
      name: "Blue baggy jeans",
      category: "trousers",
      brand: null,
    }).category,
  ).toBe("jeans");
  expect(
    normalizeClothingObservation({
      name: "Polo Ralph Lauren T-shirt",
      category: "t-shirt",
      brand: "Polo Ralph Lauren",
    }).category,
  ).toBe("t-shirt");
});

test("a garment print mentioning another clothing category does not reclassify the garment", () => {
  expect(
    normalizeClothingObservation({
      name: "Bear print shirt",
      description: "A bear wearing jeans printed on a shirt",
      category: "shirt",
      brand: null,
    }).category,
  ).toBe("shirt");
});
