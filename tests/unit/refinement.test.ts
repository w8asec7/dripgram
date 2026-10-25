import { migrateWearCounters } from "../../src/features/laundry/rules";
import { categories, categoryGroup, ProfileSchema } from "../../src/models";
import { seedData } from "../../src/mocks/seed";
import { filterGarments } from "../../src/utils/wardrobe";
import { applyCommand } from "../../src/repositories/domain";
import { fitOptions } from "../../src/utils/clothing";
test("three primary groups preserve detailed/legacy garment records", () => {
  expect(
    categories.every(
      (category) => category === "accessories" || categoryGroup(category),
    ),
  ).toBe(true);
  expect(categoryGroup("tank-top")).toBe("Tops");
  expect(categoryGroup("jacket")).toBe("Tops");
  expect(categoryGroup("jeans")).toBe("Bottoms");
  expect(categoryGroup("shoes")).toBe("Shoes");
  expect(categoryGroup("accessories")).toBeNull();
  const data = seedData(),
    original = JSON.stringify(data);
  expect(
    filterGarments(data.garments, { category: "Tops" }).every(
      (g) => categoryGroup(g.category) === "Tops",
    ),
  ).toBe(true);
  expect(
    filterGarments(data.garments, { category: "Bottoms" }).length,
  ).toBeGreaterThan(0);
  expect(
    filterGarments(data.garments, { category: "Accessories" }).length,
  ).toBeGreaterThan(0);
  expect(JSON.stringify(data)).toBe(original);
});
test("existing profiles need no reset; clothing preference persists and fit options remain editable", () => {
  const data = migrateWearCounters(seedData());
  expect(ProfileSchema.parse(data.profile)).toBeDefined();
  for (const clothingMode of ["men", "women"] as const) {
    const updated = applyCommand(data, "demo", {
      type: "profile",
      profile: {
        ...data.profile,
        preferences: { ...data.profile.preferences, clothingMode },
      },
    });
    expect(
      ProfileSchema.parse(JSON.parse(JSON.stringify(updated.profile)))
        .preferences.clothingMode,
    ).toBe(clothingMode);
    expect(updated.garments).toEqual(data.garments);
  }
  expect(fitOptions("women")).toContain("flowy");
  expect(fitOptions("men")).toContain("tapered");
});
