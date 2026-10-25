import { generateOutfit } from "../../src/services/ai";
import { seedData } from "../../src/mocks/seed";
import { assertRequiredGarment } from "../../shared/requiredGarment";
const data = seedData();
for (const id of ["g1", "g3", "g4", "g7", "g2"])
  test(`Build a Look fixes ${id} through regeneration`, () => {
    const selected = data.garments.find((g) => g.id === id)!;
    for (let variation = 0; variation < 4; variation++) {
      const result = generateOutfit({
        ownerId: "demo",
        garments: data.garments,
        preferences: data.profile.preferences,
        occasionType: "Casual day",
        requiredGarmentId: id,
        variation,
      });
      expect(
        result.outfit?.items.some((i) => i.garmentId === selected.id),
      ).toBe(true);
      expect(new Set(result.outfit?.items.map((i) => i.garmentId)).size).toBe(
        result.outfit?.items.length,
      );
    }
  });
test("foreign/missing required pieces fail without fabricating ownership", () => {
  expect(() =>
    generateOutfit({
      ownerId: "outsider",
      garments: data.garments,
      preferences: data.profile.preferences,
      occasionType: "Casual day",
      requiredGarmentId: "g1",
    }),
  ).toThrow(/closet/);
  expect(() =>
    assertRequiredGarment([{ role: "top", garmentId: "g5" }], "g1"),
  ).toThrow(/required/);
});
test("generic styling remains free to select different combinations", () => {
  const options = [0, 1, 2].map((variation) =>
    generateOutfit({
      ownerId: "demo",
      garments: data.garments,
      preferences: data.profile.preferences,
      occasionType: "Casual day",
      variation,
    })
      .outfit!.items.map((i) => i.garmentId)
      .join(","),
  );
  expect(new Set(options).size).toBeGreaterThan(1);
});

test("a fixed top with one bottom honestly reports no alternate combination", () => {
  const result = generateOutfit({
    ownerId: "demo",
    garments: data.garments.filter((g) => ["g1", "g5", "g3"].includes(g.id)),
    preferences: data.profile.preferences,
    occasionType: "Casual day",
    requiredGarmentId: "g1",
    variation: 1,
  });
  expect(result.outfit?.items.map((i) => i.garmentId)).toEqual(["g1", "g3"]);
  expect(result.message).toMatch(/No different suitable/);
});
