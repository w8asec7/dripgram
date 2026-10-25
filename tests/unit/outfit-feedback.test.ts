import { seedData } from "../../src/mocks/seed";
import { OutfitFeedbackSchema } from "../../src/models";
import { applyCommand } from "../../src/repositories/domain";
import { MockRepository, MemoryStore } from "../../src/repositories/mock";
test("feedback records a stable owned outfit snapshot without inventory or laundry changes", () => {
  const d = seedData(),
    o = d.outfits[0];
  const next = applyCommand(d, "demo", {
    type: "outfit.feedback",
    outfit: o,
    response: "wore",
  });
  expect(next.outfitFeedback).toHaveLength(1);
  expect(next.outfitFeedback[0]).toMatchObject({
    id: o.id,
    ownerId: "demo",
    outfitId: o.id,
    garmentIds: o.items.map((i) => i.garmentId),
    occasionType: o.occasionType,
    response: "wore",
  });
  for (const key of ["garments", "wears", "essentials", "outfits"] as const)
    expect(next[key]).toEqual(d[key]);
});
test("repeated writes deduplicate; changing and undoing feedback preserve the original timestamp", () => {
  const d = seedData(),
    outfit = d.outfits[0];
  const first = applyCommand(d, "demo", {
    type: "outfit.feedback",
    outfit,
    response: "wore",
  });
  const same = applyCommand(first, "demo", {
    type: "outfit.feedback",
    outfit,
    response: "wore",
  });
  expect(same.outfitFeedback).toEqual(first.outfitFeedback);
  const changed = applyCommand(same, "demo", {
    type: "outfit.feedback",
    outfit,
    response: "did-not-wear",
  });
  expect(changed.outfitFeedback).toHaveLength(1);
  expect(changed.outfitFeedback[0].response).toBe("did-not-wear");
  expect(changed.outfitFeedback[0].createdAt).toBe(
    first.outfitFeedback[0].createdAt,
  );
  expect(
    applyCommand(changed, "demo", {
      type: "outfit.feedback",
      outfit,
      response: null,
    }).outfitFeedback,
  ).toEqual([]);
});
test("feedback rejects foreign/missing/duplicate garment references and invalid response types", () => {
  const d = seedData(),
    outfit = d.outfits[0];
  expect(() =>
    applyCommand(d, "demo", {
      type: "outfit.feedback",
      outfit: { ...outfit, ownerId: "other" },
      response: "wore",
    }),
  ).toThrow(/permission/);
  expect(() =>
    applyCommand(d, "demo", {
      type: "outfit.feedback",
      outfit: { ...outfit, items: [{ role: "top", garmentId: "missing" }] },
      response: "wore",
    }),
  ).toThrow(/exists/);
  expect(() =>
    applyCommand(d, "demo", {
      type: "outfit.feedback",
      outfit: { ...outfit, items: [outfit.items[0], outfit.items[0]] },
      response: "wore",
    }),
  ).toThrow(/distinct/);
  expect(OutfitFeedbackSchema.safeParse({ response: "dirty" }).success).toBe(
    false,
  );
});
test("legacy accounts load feedback defaults; local responses persist across repository restart", async () => {
  const store = new MemoryStore(),
    repo = new MockRepository(store),
    { outfitFeedback, ...legacy } = seedData();
  expect(outfitFeedback).toEqual([]);
  await store.setItem("thread.demo.v1", JSON.stringify(legacy));
  expect((await repo.load("demo")).outfitFeedback).toEqual([]);
  const outfit = legacy.outfits[0];
  await repo.execute("demo", {
    type: "outfit.feedback",
    outfit,
    response: "did-not-wear",
  });
  const restored = await new MockRepository(store).load("demo");
  expect(restored.outfitFeedback[0].response).toBe("did-not-wear");
  expect(restored.garments).toEqual(legacy.garments);
  await repo.execute("demo", {
    type: "outfit.feedback",
    outfit,
    response: null,
  });
  expect((await new MockRepository(store).load("demo")).outfitFeedback).toEqual(
    [],
  );
});
