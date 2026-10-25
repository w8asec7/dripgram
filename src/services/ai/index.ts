import {
  garmentRole,
  requireOwnedGarment,
  assertRequiredGarment,
} from "../../../shared/requiredGarment";
import { occasionScore } from "../../../shared/styling";
import { WeatherSchema, weatherGuidance } from "../../../shared/weather";
import { z } from "zod";
import {
  Category,
  Garment,
  GarmentSchema,
  Outfit,
  OutfitSchema,
  ProductSchema,
  ProfileSchema,
  categories,
  occasionTypes,
  makeId,
  isoNow,
} from "../../models";
export const AnalysisInputSchema = z.object({
  uri: z.string().min(1),
  hint: z.string().optional(),
});
export const GarmentAnalysisSchema = GarmentSchema.pick({
  name: true,
  category: true,
  primaryColor: true,
  secondaryColors: true,
  pattern: true,
  fit: true,
  styleTags: true,
  brand: true,
}).extend({
  silhouette: z.string().optional(),
  texture: z.array(z.string()).optional(),
  colorReview: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
  subcategory: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  season: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  description: z.string().optional(),
  searchKeywords: z.array(z.string()).optional(),
  uncertainFields: z.array(z.string()).optional(),
});
export const OutfitInputSchema = z.object({
  requiredGarmentId: z.string().min(1).max(128).optional(),
  ownerId: z.string(),
  occasionType: z.enum(occasionTypes),
  dressCode: z.string().default(""),
  garments: z.array(GarmentSchema),
  preferences: ProfileSchema.shape.preferences,
  color: z.string().optional(),
  style: z.string().optional(),
  variation: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  includeAccessories: z.boolean().default(false),
  layering: z.enum(["auto", "none", "layered"]).default("auto"),
  weather: WeatherSchema.nullable().optional(),
  replaceRole: OutfitSchema.shape.items.element.shape.role.optional(),
  currentItems: OutfitSchema.shape.items.optional(),
});
export const OutfitResultSchema = z.object({
  outfit: OutfitSchema.nullable(),
  message: z.string(),
  source: z.enum(["deterministic-demo", "meta"]),
});
export const WardrobeInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  explanation: z.string(),
  query: z.string(),
  category: z.enum(categories).optional(),
  kind: z.enum(["owned", "gap", "similar"]),
});
export const GroupResultSchema = z.object({
  palette: z.array(z.string()),
  dressCode: z.string(),
  recommendations: z.array(z.string()),
  coordination: z.string(),
  source: z.enum(["deterministic-demo", "meta"]),
});
export const GroupInputSchema = z.object({
  dressCode: z.string(),
  theme: z.string(),
  participants: z.number().int().positive(),
});
export const OccasionInputSchema = z.object({ type: z.enum(occasionTypes) });
export const CompatibilityResultSchema = z.number().min(0).max(100);
export const ShoppingQuerySchema = z.object({
  query: z.string(),
  category: z.enum(categories).optional(),
});
export const OccasionInterpretationSchema = z.object({
  dressCode: z.string(),
  tips: z.array(z.string()),
});
export const CompatibilityInputSchema = z.object({
  product: ProductSchema,
  garments: z.array(GarmentSchema),
});
export interface AIService {
  analyzeClothing(
    input: z.infer<typeof AnalysisInputSchema>,
  ): Promise<z.infer<typeof GarmentAnalysisSchema>>;
  extractAttributes(
    input: z.infer<typeof AnalysisInputSchema>,
  ): Promise<z.infer<typeof GarmentAnalysisSchema>>;
  generateOutfit(
    input: z.input<typeof OutfitInputSchema>,
  ): Promise<z.infer<typeof OutfitResultSchema>>;
  analyzeWardrobe(
    garments: Garment[],
  ): Promise<z.infer<typeof WardrobeInsightSchema>[]>;
  shoppingQuery(garment: Garment): Promise<z.infer<typeof ShoppingQuerySchema>>;
  scoreCompatibility(
    input: z.infer<typeof CompatibilityInputSchema>,
  ): Promise<number>;
  coordinateGroup(input: {
    dressCode: string;
    theme: string;
    participants: number;
    occasionId?: string;
  }): Promise<z.infer<typeof GroupResultSchema>>;
  interpretOccasion(
    type: string,
  ): Promise<z.infer<typeof OccasionInterpretationSchema>>;
}
export const roles = {
  top: ["t-shirt", "shirt", "tank-top", "other-top", "hoodie", "sweater"],
  bottom: ["jeans", "trousers", "shorts", "other-bottom"],
  outerwear: ["jacket", "hoodie", "sweater"],
  shoes: ["shoes"],
  accessory: ["accessories"],
} satisfies Record<string, Category[]>;
export function usable(g: Garment) {
  return !!g.id; // Legacy laundry fields are retained, but never gate styling.
}
const formal = new Set(["Interview", "Networking", "Formal event", "Wedding"]);
export function categoryAllowed(
  category: Category,
  occasion: string,
  dressCode = "",
) {
  return (
    !(formal.has(occasion) || /formal|business/i.test(dressCode)) ||
    !["t-shirt", "tank-top", "hoodie", "shorts", "jeans"].includes(category)
  );
}
export function generateOutfit(
  input: z.input<typeof OutfitInputSchema>,
): z.infer<typeof OutfitResultSchema> {
  const p = OutfitInputSchema.parse(input);
  const required = requireOwnedGarment(
    p.garments,
    p.ownerId,
    p.requiredGarmentId,
  );
  if (
    required &&
    !categoryAllowed(required.category, p.occasionType, p.dressCode)
  )
    throw new Error(
      "Your selected piece does not suit this dress code. Choose another occasion or garment.",
    );
  const requiredRole = required ? garmentRole(required.category) : null;
  const dressy =
    formal.has(p.occasionType) || /formal|business/i.test(p.dressCode);
  const available = p.garments.filter(
    (g) =>
      g.ownerId === p.ownerId &&
      usable(g) &&
      categoryAllowed(g.category, p.occasionType, p.dressCode) &&
      (!dressy ||
        !["jacket", "shoes"].includes(g.category) ||
        g.styleTags.some((tag) =>
          ["formal", "business casual", "classic", "smart casual"].includes(
            tag.toLowerCase(),
          ),
        )),
  );
  const neutral = new Set([
    "cream",
    "white",
    "black",
    "beige",
    "navy",
    "grey",
    "oatmeal",
    "brown",
  ]);
  const score = (g: Garment) =>
    occasionScore(g, p.occasionType) +
    (dressy &&
    g.styleTags.some((s) =>
      ["formal", "business casual"].includes(s.toLowerCase()),
    )
      ? 15
      : 0) +
    (g.favorite ? 3 : 0) +
    (p.color && g.primaryColor.toLowerCase() === p.color.toLowerCase()
      ? 10
      : 0) +
    (p.style &&
    g.styleTags.some((s) => s.toLowerCase() === p.style!.toLowerCase())
      ? 7
      : 0) +
    (g.styleTags.some((s) =>
      p.preferences.styles.some(
        (pref) => pref.toLowerCase() === s.toLowerCase(),
      ),
    )
      ? 2
      : 0) +
    (neutral.has(g.primaryColor) ? 2 : 0) +
    (formal.has(p.occasionType) && g.category === "shirt" ? 6 : 0);
  const items: Outfit["items"] = [];
  for (const [role, cats] of Object.entries(roles)) {
    const guidance = weatherGuidance(p.weather);
    if (role === "accessory" && !p.includeAccessories && role !== requiredRole)
      continue;
    if (
      role === "shoes" &&
      !p.includeAccessories &&
      !dressy &&
      role !== requiredRole
    )
      continue;
    if (
      role === "outerwear" &&
      role !== requiredRole &&
      (p.layering === "none" ||
        guidance === "hot" ||
        (p.layering !== "layered" && guidance !== "cool" && !p.weather?.rain))
    )
      continue;
    const candidates = available
      .filter(
        (g) =>
          (cats as readonly Category[]).includes(g.category) &&
          !(required && role !== requiredRole && g.id === required.id) &&
          !(
            requiredRole === "outerwear" &&
            role === "top" &&
            ["hoodie", "sweater"].includes(g.category)
          ) &&
          !items.some((i) => i.garmentId === g.id) &&
          (role !== "outerwear" ||
            !items.some(
              (i) =>
                i.role === "top" &&
                ["hoodie", "sweater"].includes(
                  available.find((g) => g.id === i.garmentId)?.category || "",
                ),
            )) &&
          !(
            role === "top" &&
            g.id !== required?.id &&
            weatherGuidance(p.weather) === "hot" &&
            ["hoodie", "sweater"].includes(g.category)
          ),
      )
      .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    if (required && role === requiredRole) {
      items.push({ garmentId: required.id, role: requiredRole });
      continue;
    }
    const current = p.currentItems?.find(
      (item) => item.role === role,
    )?.garmentId;
    const choices =
      p.variation > 0 && role === "top" && candidates.length > 1 && current
        ? candidates.filter((g) => g.id !== current)
        : candidates;
    if (choices.length)
      items.push({
        garmentId: choices[p.variation % choices.length].id,
        role: role as Outfit["items"][number]["role"],
      });
  }
  if (
    !items.some((x) => x.role === "top") ||
    !items.some((x) => x.role === "bottom")
  )
    return {
      outfit: null,
      message:
        "Add a top and bottom suited to this occasion, or try a more relaxed dress code.",
      source: "deterministic-demo",
    };
  assertRequiredGarment(items, p.requiredGarmentId);
  const outfit: Outfit = {
    id: makeId("outfit"),
    ownerId: p.ownerId,
    name: `${p.occasionType}, your way`,
    occasionType: p.occasionType,
    items,
    explanation: `A ${p.occasionType.toLowerCase()} look built from your wardrobe. ${p.color ? `Your ${p.color} preference leads the palette. ` : "Neutral foundations keep the palette easy to wear. "}${p.dressCode ? `Styled for ${p.dressCode.toLowerCase()}. ` : ""}Swap any piece to make it yours.`,
    createdAt: isoNow(),
    plannedFor: null,
    confirmedAt: null,
  };
  return OutfitResultSchema.parse({
    outfit,
    message:
      p.variation > 0 &&
      !(["top", "bottom"] as const)
        .filter((role) => role !== requiredRole)
        .some(
          (role) =>
            available.filter(
              (g) =>
                (roles[role] as readonly string[]).includes(g.category) &&
                !(
                  requiredRole === "outerwear" &&
                  role === "top" &&
                  ["hoodie", "sweater"].includes(g.category)
                ),
            ).length > 1,
        )
        ? "No different suitable combination is available yet. Add another top or bottom to create more options."
        : "Built with deterministic styling rules. No live AI used.",
    source: "deterministic-demo",
  });
}
export function wardrobeInsights(
  garments: Garment[],
): z.infer<typeof WardrobeInsightSchema>[] {
  const tops = garments.filter((g) =>
    roles.top.includes(g.category as (typeof roles.top)[number]),
  );
  const bottoms = garments.filter((g) =>
    roles.bottom.includes(g.category as (typeof roles.bottom)[number]),
  );
  const usableCount = garments.filter(usable).length;
  const results: z.infer<typeof WardrobeInsightSchema>[] = [
    {
      id: "owned",
      title: "Your next look is already here",
      explanation: `${usableCount} available pieces. Start with a favorite top and rotate your bottoms before buying anything new.`,
      query: "",
      kind: "owned",
    },
  ];
  if (bottoms.length < Math.max(2, tops.length / 2))
    results.push({
      id: "bottoms",
      title: "One versatile bottom, more possibilities",
      explanation: `You have ${tops.length} tops and ${bottoms.length} bottoms. Neutral trousers could add useful combinations.`,
      query: "trousers",
      category: "trousers",
      kind: "gap",
    });
  if (!garments.some((g) => g.category === "shirt"))
    results.push({
      id: "formal",
      title: "Room for a smart layer",
      explanation:
        "A shirt could help your existing trousers work for interviews and dinners.",
      query: "Oxford shirt",
      category: "shirt",
      kind: "gap",
    });
  if (
    !garments.some(
      (g) => g.category === "jacket" && g.styleTags.includes("Formal"),
    )
  )
    results.push({
      id: "formal-layer",
      title: "If a formal occasion comes calling",
      explanation:
        "Your shirts and tailored trousers already do the work. If a venue requires a blazer, one tailored layer could finish those existing looks; borrow one first.",
      query: "jacket",
      category: "jacket",
      kind: "gap",
    });
  const byColor = new Map<string, number>();
  garments.forEach((g) => {
    const k = `${g.primaryColor} ${g.category}`;
    byColor.set(k, (byColor.get(k) || 0) + 1);
  });
  const duplicate = Array.from(byColor).find(([, n]) => n > 1);
  results.push(
    duplicate
      ? {
          id: "similar",
          title: "A familiar favorite",
          explanation: `You own ${duplicate[1]} pieces in ${duplicate[0]}. Try styling them differently before adding another.`,
          query: "",
          kind: "similar",
        }
      : {
          id: "balance",
          title: "A wardrobe with range",
          explanation:
            "You have a good category mix. Rewear and rotate your pieces before adding more.",
          query: "",
          kind: "owned",
        },
  );
  return results;
}
export class MockAIService implements AIService {
  async analyzeClothing(input: z.infer<typeof AnalysisInputSchema>) {
    AnalysisInputSchema.parse(input);
    return GarmentAnalysisSchema.parse({
      name: input.hint || "My new garment",
      category: "t-shirt",
      primaryColor: "unknown",
      secondaryColors: [],
      pattern: "solid",
      fit: "unknown",
      uncertainFields: ["category", "primaryColor", "fit"],
      description:
        "Demo mode does not inspect photographs. Enter the details you see, or sign in for Meta recognition.",
      styleTags: [],
      brand: null,
      confidence: "low",
    });
  }
  extractAttributes(input: z.infer<typeof AnalysisInputSchema>) {
    return this.analyzeClothing(input);
  }
  async generateOutfit(input: z.input<typeof OutfitInputSchema>) {
    return generateOutfit(input);
  }
  async analyzeWardrobe(garments: Garment[]) {
    return wardrobeInsights(z.array(GarmentSchema).parse(garments));
  }
  async shoppingQuery(garment: Garment) {
    const g = GarmentSchema.parse(garment);
    return ShoppingQuerySchema.parse({
      query: `${g.primaryColor} ${g.category}`,
      category: g.category,
    });
  }
  async scoreCompatibility(input: z.infer<typeof CompatibilityInputSchema>) {
    const p = CompatibilityInputSchema.parse(input);
    return CompatibilityResultSchema.parse(
      Math.min(
        100,
        50 +
          p.garments.filter(
            (g) => g.category !== p.product.category && usable(g),
          ).length *
            3,
      ),
    );
  }
  async coordinateGroup(input: {
    dressCode: string;
    theme: string;
    participants: number;
    occasionId?: string;
  }) {
    GroupInputSchema.parse(input);
    return GroupResultSchema.parse({
      palette: ["#89947B", "#D3C4A7", "#F0EBDF", "#3B433A"],
      dressCode: input.dressCode || "Relaxed and considered",
      recommendations: [
        "Start with a piece you already love.",
        "Use one shared accent color; let individual styles lead.",
        "An olive layer, cream top, and neutral bottoms work as a shared starting point.",
      ],
      coordination: `${input.participants} people, individual style. ${input.theme || "Coordinate a palette without matching every piece."}`,
      source: "deterministic-demo",
    });
  }
  async interpretOccasion(type: string) {
    OccasionInputSchema.parse({ type });
    return OccasionInterpretationSchema.parse({
      dressCode: formal.has(type) ? "Formal / tailored" : "Smart casual",
      tips: [
        "Check the venue and weather.",
        "Confirm the dress code with your host.",
      ],
    });
  }
}
