import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { MetaProvider } from "../providers/meta";
import { RequestCache, UsageMeter } from "../core";
import { ConfigSchema } from "../config";
import { RecommendRequestSchema } from "../../shared/protocol";
import { seedGarments, defaultPreferences } from "../../src/mocks/seed";
import { generateOutfit } from "../../src/services/ai";
class ObservedChoice extends MetaProvider {
  prompts: string[] = [];
  override async structured<T>(
    _uid: string,
    _kind: string,
    prompt: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.prompts.push(prompt);
    const json = z.toJSONSchema(schema) as {
      properties: Record<string, { enum?: string[]; const?: string }>;
    };
    return schema.parse({
      topId: json.properties.topId.enum?.[0],
      bottomId: json.properties.bottomId.enum?.[0],
      outerwearId: json.properties.outerwearId.const || null,
      shoesId: json.properties.shoesId.const || null,
      accessoryId: json.properties.accessoryId.const || null,
      explanation: "Fixture model selects the highest occasion-ranked options.",
    });
  }
}
test("occasion direction ranks different valid clothing; Try Another excludes the current core combination", async () => {
  const provider = new ObservedChoice(
    ConfigSchema.parse({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread" }),
    new RequestCache(),
    new UsageMeter(),
  );
  const clothes = seedGarments.map((g) => ({ ...g, ownerId: "alice" }));
  const first = await provider.outfit(
    "alice",
    clothes,
    RecommendRequestSchema.parse({ occasionType: "Casual day" }),
    defaultPreferences,
  );
  const classes = await provider.outfit(
    "alice",
    clothes,
    RecommendRequestSchema.parse({ occasionType: "Classes" }),
    defaultPreferences,
  );
  const dinner = await provider.outfit(
    "alice",
    clothes,
    RecommendRequestSchema.parse({ occasionType: "Dinner" }),
    defaultPreferences,
  );
  assert.notEqual(
    first.outfit?.items[0].garmentId,
    classes.outfit?.items[0].garmentId,
  );
  assert.notEqual(
    first.outfit?.items[0].garmentId,
    dinner.outfit?.items[0].garmentId,
  );
  assert.match(provider.prompts[2], /Elevated smart casual/);
  const next = await provider.outfit(
    "alice",
    clothes,
    RecommendRequestSchema.parse({
      occasionType: "Casual day",
      variation: 1,
      currentItems: first.outfit!.items,
    }),
    defaultPreferences,
  );
  assert.notDeepEqual(first.outfit?.items, next.outfit?.items);
  assert.equal(next.outfit?.occasionType, "Casual day");
  assert.ok(
    next.outfit?.items.every((i) => clothes.some((g) => g.id === i.garmentId)),
  );
  const single = clothes.filter((g) => ["g1", "g3"].includes(g.id));
  const limited = await provider.outfit(
    "alice",
    single,
    RecommendRequestSchema.parse({
      occasionType: "Casual day",
      variation: 2,
      currentItems: [
        { garmentId: "g1", role: "top" },
        { garmentId: "g3", role: "bottom" },
      ],
    }),
    defaultPreferences,
  );
  assert.match(limited.message, /limited suitable alternatives/);
});
test("offline occasion choices are meaningful with a diverse wardrobe and legacy dirty flags do not gate styling", () => {
  const looks = ["Casual day", "Classes", "Dinner", "Date", "Party"].map(
    (occasionType) =>
      generateOutfit({
        ownerId: "demo",
        occasionType: occasionType as "Casual day",
        garments: seedGarments,
        preferences: defaultPreferences,
      })
        .outfit!.items.map((i) => i.garmentId)
        .join(","),
  );
  assert.equal(new Set(looks).size, 5);
});

test("server fixes required tops/bottoms/shoes/layers and rejects foreign constraints", async () => {
  const provider = new ObservedChoice(
    ConfigSchema.parse({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread" }),
    new RequestCache(),
    new UsageMeter(),
  );
  const clothes = seedGarments.map((g) => ({ ...g, ownerId: "alice" }));
  for (const id of ["g1", "g3", "g4", "g7", "g2"]) {
    let current: import("../../src/models").Outfit["items"] | undefined;
    for (let variation = 0; variation < 3; variation++) {
      const result = await provider.outfit(
        "alice",
        clothes,
        RecommendRequestSchema.parse({
          occasionType: "Casual day",
          requiredGarmentId: id,
          variation,
          currentItems: current,
        }),
        defaultPreferences,
      );
      assert.ok(result.outfit?.items.some((i) => i.garmentId === id));
      assert.equal(
        new Set(result.outfit!.items.map((i) => i.garmentId)).size,
        result.outfit!.items.length,
      );
      current = result.outfit!.items;
    }
  }
  await assert.rejects(
    () =>
      provider.outfit(
        "outsider",
        clothes,
        RecommendRequestSchema.parse({
          occasionType: "Casual day",
          requiredGarmentId: "g1",
        }),
        defaultPreferences,
      ),
    /closet/,
  );
  await assert.rejects(
    () =>
      provider.outfit(
        "alice",
        clothes,
        RecommendRequestSchema.parse({
          occasionType: "Casual day",
          requiredGarmentId: "g4",
          replaceRole: "shoes",
        }),
        defaultPreferences,
      ),
    /fixed/,
  );
});

test("independent server validation rejects a provider response that ignores a mandatory piece", async () => {
  class IgnoresConstraint extends MetaProvider {
    override async structured<T>(): Promise<T> {
      return {
        topId: "g5",
        bottomId: "g3",
        outerwearId: null,
        shoesId: null,
        accessoryId: null,
        explanation: "Ignored fixed top.",
      } as T;
    }
  }
  const provider = new IgnoresConstraint(
    ConfigSchema.parse({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread" }),
    new RequestCache(),
    new UsageMeter(),
  );
  await assert.rejects(
    () =>
      provider.outfit(
        "demo",
        seedGarments,
        RecommendRequestSchema.parse({
          occasionType: "Casual day",
          requiredGarmentId: "g1",
        }),
        defaultPreferences,
      ),
    /required piece/,
  );
});

test("a mandatory jacket never loses its only compatible base top during regeneration", async () => {
  const provider = new ObservedChoice(
    ConfigSchema.parse({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: "demo-thread" }),
    new RequestCache(),
    new UsageMeter(),
  );
  const clothes = seedGarments.filter((g) =>
    ["g7", "g1", "g2", "g3"].includes(g.id),
  );
  const first = await provider.outfit(
    "demo",
    clothes,
    RecommendRequestSchema.parse({
      occasionType: "Casual day",
      requiredGarmentId: "g7",
    }),
    defaultPreferences,
  );
  const next = await provider.outfit(
    "demo",
    clothes,
    RecommendRequestSchema.parse({
      occasionType: "Casual day",
      requiredGarmentId: "g7",
      variation: 1,
      currentItems: first.outfit!.items,
    }),
    defaultPreferences,
  );
  assert.ok(next.outfit?.items.some((i) => i.garmentId === "g1"));
  assert.ok(next.outfit?.items.some((i) => i.garmentId === "g7"));
  assert.match(next.message, /limited suitable alternatives/);
});
