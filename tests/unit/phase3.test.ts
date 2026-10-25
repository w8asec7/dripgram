import { seedData } from "../../src/mocks/seed";
import { dateOffset, GarmentSchema } from "../../src/models";
import { applyCommand } from "../../src/repositories/domain";
import { migrateWearCounters } from "../../src/features/laundry/rules";
import {
  reviewAnalysis,
  normalizeColor,
} from "../../src/features/recognition/review";
test("a custom name cannot suppress a red analysis result; user color edits win", () => {
  const g = seedData().garments[0];
  const analysis = {
    name: "Red Oversized T-Shirt",
    primaryColor: "red",
    fit: "oversized",
  };
  expect(
    reviewAnalysis(
      { ...g, name: "Favorite shirt" },
      analysis,
      new Set(["name"]),
    ),
  ).toMatchObject({
    name: "Favorite shirt",
    primaryColor: "red",
    fit: "oversized",
  });
  expect(
    reviewAnalysis(g, analysis, new Set(["primaryColor"])).primaryColor,
  ).toBe(g.primaryColor);
  expect(normalizeColor(" RED ")).toBe("red");
  expect(normalizeColor("cream")).toBe("cream");
  expect(GarmentSchema.parse({ ...g, ...analysis }).primaryColor).toBe("red");
});
test("legacy counter migration preserves records/history/availability and is idempotent", () => {
  const d = seedData();
  d.wears = [
    {
      id: "old",
      ownerId: "demo",
      garmentIds: ["g1"],
      outfitId: null,
      date: dateOffset(-3),
      createdAt: new Date().toISOString(),
    },
  ];
  const m = migrateWearCounters(d);
  expect(m.garments[0]).toMatchObject({
    wearCount: 1,
    maxWearsBeforeLaundry: 1,
    availability: d.garments[0].availability,
  });
  expect(m.wears).toEqual(d.wears);
  expect(migrateWearCounters(m)).toEqual(m);
});
test("reusable hoodie reaches its own limit, manual override works, clean resets, shoes stay available", () => {
  let d = migrateWearCounters(seedData());
  const hoodie = d.garments.find((g) => g.category === "hoodie")!,
    shoe = d.garments.find((g) => g.category === "shoes")!;
  hoodie.availability = "available";
  hoodie.wearCount = 0;
  shoe.availability = "available";
  for (let day = -2; day <= 0; day++) {
    d = applyCommand(d, "demo", {
      type: "wear",
      date: dateOffset(day),
      outfitId: null,
      garmentIds: [hoodie.id, shoe.id],
    });
    expect(d.garments.find((g) => g.id === hoodie.id)?.availability).toBe(
      day === 0 ? "laundry" : "reusable",
    );
  }
  expect(d.garments.find((g) => g.id === shoe.id)).toMatchObject({
    wearCount: 3,
    availability: "available",
  });
  d = applyCommand(d, "demo", {
    type: "laundry",
    ids: [hoodie.id],
    availability: "reusable",
  });
  expect(d.garments.find((g) => g.id === hoodie.id)?.manuallyOverridden).toBe(
    true,
  );
  d = applyCommand(d, "demo", {
    type: "laundry",
    ids: [hoodie.id],
    availability: "available",
  });
  expect(d.garments.find((g) => g.id === hoodie.id)).toMatchObject({
    wearCount: 0,
    availability: "available",
  });
});
test("only selected pieces change and duplicate submission never increments twice", () => {
  const initial = migrateWearCounters(seedData());
  const d = applyCommand(initial, "demo", {
    type: "wear",
    date: dateOffset(0),
    garmentIds: ["g1"],
    outfitId: null,
    keepAvailableIds: ["g1"],
  });
  expect(d.garments.find((g) => g.id === "g1")).toMatchObject({
    wearCount: 1,
    availability: "reusable",
  });
  expect(d.garments.find((g) => g.id === "g3")).toEqual(
    initial.garments.find((g) => g.id === "g3"),
  );
  expect(() =>
    applyCommand(d, "demo", {
      type: "wear",
      date: dateOffset(0),
      garmentIds: ["g1"],
      outfitId: null,
    }),
  ).toThrow("already");
});

test("social groups share only selected owned pieces, support opinions and protect other wardrobes", () => {
  let d = seedData();
  d = applyCommand(d, "demo", {
    type: "group.save",
    group: {
      id: "qa-group",
      ownerId: "demo",
      name: "Dinner crew",
      memberIds: ["demo", "maya"],
      createdAt: new Date().toISOString(),
    },
  });
  d = applyCommand(d, "demo", {
    type: "look.share",
    id: "qa-look",
    title: "Dinner fits",
    garmentIds: ["g1"],
    outfitId: null,
    groupId: "qa-group",
    friendIds: [],
  });
  expect(
    d.looks.find((l) => l.id === "qa-look")?.pieces.map((p) => p.id),
  ).toEqual(["g1"]);
  expect(() =>
    applyCommand(d, "demo", {
      type: "look.share",
      id: "bad",
      title: "Secret",
      garmentIds: ["not-owned"],
      outfitId: null,
      groupId: "qa-group",
      friendIds: [],
    }),
  ).toThrow("no longer");
  d = applyCommand(d, "demo", { type: "look.react", id: "qa-look" });
  d = applyCommand(d, "demo", {
    type: "look.comment",
    id: "qa-look",
    text: "Black pants would work.",
  });
  expect(d.looks.find((l) => l.id === "qa-look")).toMatchObject({
    reactions: ["demo"],
    comments: [{ text: "Black pants would work." }],
  });
});

test("default looks contain two clothing pieces, optional cool layers and explicit accessories", () => {
  const d = seedData();
  const input = {
    ownerId: "demo",
    occasionType: "Casual day" as const,
    garments: d.garments,
    preferences: d.profile.preferences,
  };
  const { generateOutfit } =
    require("../../src/services/ai") as typeof import("../../src/services/ai");
  const current = {
    city: "Austin",
    temperatureF: 85,
    rain: false,
    observedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    source: "Open-Meteo" as const,
  };
  expect(generateOutfit(input).outfit?.items.map((i) => i.role)).toEqual([
    "top",
    "bottom",
  ]);
  const hot = generateOutfit({
    ...input,
    weather: current,
    layering: "layered",
  }).outfit!;
  expect(hot.items).toHaveLength(2);
  const cool = generateOutfit({
    ...input,
    weather: { ...current, temperatureF: 58 },
  }).outfit!;
  expect(cool.items.length).toBeLessThanOrEqual(3);
  expect(cool.items.some((i) => ["shoes", "accessory"].includes(i.role))).toBe(
    false,
  );
  expect(
    generateOutfit({ ...input, includeAccessories: true }).outfit?.items.some(
      (i) => i.role === "shoes",
    ),
  ).toBe(true);
});
test("reminder times validate local wall-clock hours and weather has a stale-data fallback", () => {
  const { reminderTime } =
    require("../../src/services/notifications") as typeof import("../../src/services/notifications");
  expect(reminderTime()).toEqual({ hour: 8, minute: 30 });
  expect(reminderTime("23:59")).toEqual({ hour: 23, minute: 59 });
  expect(() => reminderTime("25:00")).toThrow("HH:MM");
  const { weatherGuidance } =
    require("../../shared/weather") as typeof import("../../shared/weather");
  expect(weatherGuidance(null)).toBe("unavailable");
  expect(
    weatherGuidance({
      city: "Austin",
      temperatureF: 90,
      rain: false,
      observedAt: "2020-01-01T00:00:00.000Z",
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo",
    }),
  ).toBe("unavailable");
});

test("historical entries before the last clean do not consume current reuse inventory", () => {
  const d = migrateWearCounters(seedData());
  const g = d.garments.find((g) => g.id === "g1")!;
  g.wearCount = 0;
  g.lastCleanedAt = new Date().toISOString();
  g.lastWornAt = dateOffset(0);
  const next = applyCommand(d, "demo", {
    type: "wear",
    garmentIds: ["g1"],
    outfitId: null,
    date: dateOffset(-2),
  });
  expect(next.garments.find((g) => g.id === "g1")).toMatchObject({
    wearCount: 0,
    lastWornAt: dateOffset(0),
    availability: g.availability,
  });
  expect(next.wears).toHaveLength(1);
  expect(() =>
    applyCommand(d, "demo", {
      type: "wear",
      garmentIds: ["g1"],
      outfitId: null,
      date: "2026-02-31",
    }),
  ).toThrow("past date");
});

test("washed resets all availability and wear counters while retaining garments and history", () => {
  const d = migrateWearCounters(seedData());
  d.garments.forEach((g) => {
    g.wearCount = 3;
    g.availability = "laundry";
  });
  d.essentials.forEach((e) => {
    e.clean = 0;
  });
  const next = applyCommand(d, "demo", { type: "wardrobe.washed" });
  expect(next.garments).toHaveLength(d.garments.length);
  expect(
    next.garments.every(
      (g) =>
        g.availability === "available" &&
        g.wearCount === 0 &&
        !!g.lastCleanedAt,
    ),
  ).toBe(true);
  expect(next.essentials.every((e) => e.clean === e.total)).toBe(true);
  expect(next.wears).toEqual(d.wears);
  expect(next.outfits).toEqual(d.outfits);
});
test("bulk delete removes selected garments and outfit references, with ownership checks", () => {
  const d = seedData();
  const next = applyCommand(d, "demo", {
    type: "garment.deleteMany",
    ids: ["g1", "g3"],
  });
  expect(next.garments).toHaveLength(d.garments.length - 2);
  expect(
    next.outfits
      .flatMap((o) => o.items)
      .some((i) => ["g1", "g3"].includes(i.garmentId)),
  ).toBe(false);
  expect(next.wears).toEqual(d.wears);
  expect(() =>
    applyCommand(d, "demo", {
      type: "garment.deleteMany",
      ids: ["g1", "not-owned"],
    }),
  ).toThrow();
  expect(d.garments).toHaveLength(18);
});
test("sample catalog contains over one hundred distinct products even with shared retailer homepages", () => {
  const { products } =
    require("../../src/mocks/seed") as typeof import("../../src/mocks/seed");
  const { uniqueProducts } =
    require("../../shared/feed") as typeof import("../../shared/feed");
  expect(products.length).toBeGreaterThanOrEqual(100);
  expect(uniqueProducts(products)).toHaveLength(products.length);
  expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
});

test("live discovery deduplicates the same product offered by multiple retailers", () => {
  const { uniqueProducts } =
    require("../../shared/feed") as typeof import("../../shared/feed");
  const p =
    seedData().watches[0].product ||
    require("../../src/mocks/seed").products[0];
  expect(
    uniqueProducts([
      {
        ...p,
        id: "a",
        sample: false,
        providerId: "same-product",
        offer: { ...p.offer, retailer: "Store A" },
      },
      {
        ...p,
        id: "b",
        sample: false,
        providerId: "same-product",
        offer: { ...p.offer, retailer: "Store B" },
      },
    ]),
  ).toHaveLength(1);
});
