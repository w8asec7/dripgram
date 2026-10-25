import { validateImageMetadata } from "../../src/utils/imageMetadata";
import { seedData, products } from "../../src/mocks/seed";
import {
  AppDataSchema,
  GarmentSchema,
  EssentialsCategorySchema,
  OccasionSchema,
  today,
} from "../../src/models";
import {
  applyCommand,
  canReadGarment,
  isFriend,
} from "../../src/repositories/domain";
import { generateOutfit, usable } from "../../src/services/ai";
import {
  filterProducts,
  discount,
  watchReached,
} from "../../src/services/shopping";
import { filterGarments } from "../../src/utils/wardrobe";
const seed = () => seedData();
describe("validated domain rules", () => {
  test("seed data satisfies the entire schema", () =>
    expect(AppDataSchema.safeParse(seed()).success).toBe(true));
  test("image metadata rejects oversized and unreadable files without camera access", () => {
    expect(() => validateImageMetadata({ width: 0, height: 1 })).toThrow(
      "read",
    );
    expect(() =>
      validateImageMetadata({
        width: 100,
        height: 100,
        fileSize: 11 * 1024 * 1024,
      }),
    ).toThrow("10 MB");
    expect(() =>
      validateImageMetadata({ width: 10, height: 10, mimeType: "video/mp4" }),
    ).toThrow("photo");
    expect(() =>
      validateImageMetadata({
        width: 100,
        height: 100,
        mimeType: "image/jpeg",
      }),
    ).not.toThrow();
  });
  test("invalid garments and counts are rejected", () => {
    expect(
      GarmentSchema.safeParse({ ...seed().garments[0], name: "" }).success,
    ).toBe(false);
    expect(
      EssentialsCategorySchema.safeParse({
        id: "e",
        ownerId: "demo",
        name: "Socks",
        total: 2,
        clean: 3,
      }).success,
    ).toBe(false);
  });
  test("editing a garment persists and owner cannot be forged", () => {
    const d = seed();
    const g = { ...d.garments[0], name: "My favorite tee" };
    expect(
      applyCommand(d, "demo", {
        type: "garment.save",
        garment: g,
      }).garments.find((x) => x.id === g.id)?.name,
    ).toBe(g.name);
    expect(() =>
      applyCommand(d, "demo", {
        type: "garment.save",
        garment: { ...g, ownerId: "other" },
      }),
    ).toThrow("permission");
  });
  test("category, text, availability and favorite filters compose", () => {
    const d = seed();
    expect(filterGarments(d.garments, { category: "T-shirts" })).toHaveLength(
      3,
    );
    expect(
      filterGarments(d.garments, { search: "cloud", favorites: true }),
    ).toHaveLength(1);
    expect(
      filterGarments(d.garments, { availability: "laundry" }),
    ).toHaveLength(2);
  });
  test("wear logs are deduplicated without assuming dirty clothes", () => {
    const d = applyCommand(seed(), "demo", {
      type: "wear",
      garmentIds: ["g1", "g1", "g3"],
      outfitId: null,
      date: today(),
    });
    expect(d.wears[0].garmentIds).toEqual(["g1", "g3"]);
    expect(d.garments.find((g) => g.id === "g1")?.availability).toBe("laundry");
    expect(d.garments.find((g) => g.id === "g3")?.availability).toBe(
      "reusable",
    );
    expect(() =>
      applyCommand(d, "demo", {
        type: "wear",
        garmentIds: ["g1"],
        outfitId: null,
        date: today(),
      }),
    ).toThrow("already");
  });
  test("skipping never changes availability", () => {
    const d = seed();
    expect(
      applyCommand(d, "demo", {
        type: "checkin.skip",
        date: today(),
      }).garments.map((g) => ({
        ...g,
        wearCount: undefined,
        maxWearsBeforeLaundry: undefined,
        lastWornAt: undefined,
        lastCleanedAt: undefined,
        manuallyOverridden: undefined,
      })),
    ).toEqual(d.garments);
  });
  test("bulk laundry transitions are reversible", () => {
    const d = applyCommand(seed(), "demo", {
      type: "laundry",
      ids: ["g1", "g3"],
      availability: "laundry",
    });
    const clean = applyCommand(d, "demo", {
      type: "laundry",
      ids: ["g1", "g3"],
      availability: "available",
    });
    expect(
      clean.garments.filter((g) => ["g1", "g3"].includes(g.id)).every(usable),
    ).toBe(true);
  });
  test("outfits respect availability, roles, occasion and unique IDs", () => {
    const d = seed();
    const r = generateOutfit({
      ownerId: "demo",
      occasionType: "Interview",
      garments: d.garments,
      preferences: d.profile.preferences,
    });
    expect(r.outfit).not.toBeNull();
    const ids = r.outfit!.items.map((i) => i.garmentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ids.every((id) => {
        const g = d.garments.find((g) => g.id === id)!;
        return (
          usable(g) &&
          !["t-shirt", "hoodie", "shorts", "jeans"].includes(g.category)
        );
      }),
    ).toBe(true);
  });
  test("incomplete wardrobes never fabricate a look", () => {
    const d = seed();
    expect(
      generateOutfit({
        ownerId: "demo",
        occasionType: "Casual day",
        garments: [],
        preferences: d.profile.preferences,
      }).outfit,
    ).toBeNull();
  });
  test("recommendations are deterministic in garment selection", () => {
    const d = seed();
    const input = {
      ownerId: "demo",
      occasionType: "Classes" as const,
      garments: d.garments,
      preferences: d.profile.preferences,
    };
    expect(generateOutfit(input).outfit?.items).toEqual(
      generateOutfit(input).outfit?.items,
    );
  });
  test("price filters, discounts and watch boundaries", () => {
    expect(
      filterProducts(products, {
        query: "",
        maxPrice: 40,
        sort: "price",
      }).every((p) => p.offer.price !== null && p.offer.price <= 40),
    ).toBe(true);
    expect(filterProducts(products, { query: "", maxPrice: 0 })).toEqual([]);
    expect(discount(products[0])).toBe(36);
    expect(discount(products[11])).toBeNull();
    expect(watchReached(40, 40)).toBe(true);
    expect(watchReached(41, 40)).toBe(false);
  });
  test("occasion invalid times are rejected", () =>
    expect(
      OccasionSchema.safeParse({ ...seed().occasions[0], time: "27:99" })
        .success,
    ).toBe(false));
  test("you are never your own friend", () =>
    expect(isFriend(seed(), "demo", "demo")).toBe(false));
  test("formal outfits favor appropriate footwear and avoid casual jackets", () => {
    const d = seed();
    const r = generateOutfit({
      ownerId: "demo",
      occasionType: "Interview",
      garments: d.garments,
      preferences: d.profile.preferences,
    });
    expect(r.outfit?.items.find((i) => i.role === "shoes")?.garmentId).toBe(
      "g11",
    );
    expect(r.outfit?.items.some((i) => i.role === "outerwear")).toBe(false);
  });
  test("friendship never grants default wardrobe access", () => {
    const d = seed();
    expect(canReadGarment(d, "maya", "g1")).toBe(false);
    const shared = applyCommand(d, "demo", {
      type: "garment.save",
      garment: {
        ...d.garments[0],
        visibility: "selected-friends",
        sharedWith: ["maya"],
      },
    });
    expect(canReadGarment(shared, "maya", "g1")).toBe(true);
    expect(canReadGarment(shared, "alex", "g1")).toBe(false);
  });
  test("deleting a garment removes dangling outfit references", () => {
    const d = applyCommand(seed(), "demo", {
      type: "garment.delete",
      id: "g1",
    });
    expect(
      d.outfits.flatMap((o) => o.items).some((i) => i.garmentId === "g1"),
    ).toBe(false);
  });
});
