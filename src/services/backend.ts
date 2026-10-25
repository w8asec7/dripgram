import { assertRequiredGarment } from "../../shared/requiredGarment";
import { z } from "zod";
import {
  AIService,
  AnalysisInputSchema,
  GarmentAnalysisSchema,
  OutfitInputSchema,
  OutfitResultSchema,
  WardrobeInsightSchema,
  ShoppingQuerySchema,
  CompatibilityInputSchema,
  GroupResultSchema,
  OccasionInterpretationSchema,
  roles,
  usable,
} from "./ai";
import {
  ShoppingService,
  SearchRequest,
  SearchResultSchema,
  SearchRequestSchema,
  TrendsResultSchema,
} from "./shopping";
import {
  Garment,
  ProductSchema,
  PriceSnapshotSchema,
  OutfitSchema,
} from "../models";
import { apiRequest, imagePayload } from "./api";
import { RecognitionSchema, AdviceSchema } from "../../shared/protocol";
export class BackendAIService implements AIService {
  constructor(protected request: typeof apiRequest = apiRequest) {}
  async analyzeClothing(input: z.infer<typeof AnalysisInputSchema>) {
    const payload = await imagePayload(input.uri);
    const result = await this.request(
      "/v1/ai/analyze",
      z.object({
        analysis: RecognitionSchema.extend({
          colorReview: z.string().optional(),
        }),
        source: z.literal("meta"),
        model: z.string(),
      }),
      payload,
    );
    return GarmentAnalysisSchema.parse(result.analysis);
  }
  extractAttributes(input: z.infer<typeof AnalysisInputSchema>) {
    return this.analyzeClothing(input);
  }
  async generateOutfit(input: z.input<typeof OutfitInputSchema>) {
    const p = OutfitInputSchema.parse(input);
    const result = await this.request("/v1/ai/outfit", OutfitResultSchema, {
      requiredGarmentId: p.requiredGarmentId,
      occasionType: p.occasionType,
      dressCode: p.dressCode,
      color: p.color,
      style: p.style,
      notes: p.notes,
      includeAccessories: p.includeAccessories,
      layering: p.layering,
      variation: p.variation,
      currentItems: p.currentItems,
      replaceRole: p.replaceRole,
    });
    if (result.outfit) {
      OutfitSchema.parse(result.outfit);
      assertRequiredGarment(result.outfit.items, p.requiredGarmentId);
      const ids = new Set<string>();
      for (const item of result.outfit.items) {
        const g = p.garments.find((g) => g.id === item.garmentId);
        if (
          !g ||
          g.ownerId !== p.ownerId ||
          !usable(g) ||
          !(roles[item.role] as readonly string[]).includes(g.category) ||
          ids.has(g.id)
        )
          throw new Error(
            "The wardrobe changed. Refresh your closet before requesting another look.",
          );
        ids.add(g.id);
      }
    }
    return result;
  }
  async analyzeWardrobe() {
    const result = await this.request(
      "/v1/ai/wardrobe",
      z.object({
        insights: z.array(WardrobeInsightSchema),
        source: z.literal("meta"),
      }),
      {},
    );
    return result.insights;
  }
  async shoppingQuery(garment: Garment) {
    return ShoppingQuerySchema.parse({
      query:
        garment.searchKeywords?.[0] ||
        `${garment.primaryColor} ${garment.fit} ${garment.category}`,
      category: garment.category,
    });
  }
  async scoreCompatibility(input: z.infer<typeof CompatibilityInputSchema>) {
    const result = await this.request(
      `/v1/shopping/products/${encodeURIComponent(input.product.id)}/advice`,
      AdviceSchema,
      {},
    );
    return result.matchingGarmentIds.length;
  }
  coordinateGroup(input: {
    dressCode: string;
    theme: string;
    participants: number;
    occasionId?: string;
  }) {
    if (!input.occasionId)
      throw new Error(
        "Select a shared occasion before requesting group coordination.",
      );
    return this.request("/v1/ai/group", GroupResultSchema, {
      occasionId: input.occasionId,
    });
  }
  interpretOccasion(type: string) {
    return this.request("/v1/ai/occasion", OccasionInterpretationSchema, {
      type,
    });
  }
}
export class BackendShoppingService implements ShoppingService {
  constructor(protected request: typeof apiRequest = apiRequest) {}
  search(input: SearchRequest) {
    return this.request(
      "/v1/shopping/search",
      SearchResultSchema,
      SearchRequestSchema.parse(input),
    );
  }
  async visualSearch(input: { uri: string; filters: SearchRequest }) {
    return this.request("/v1/shopping/visual", SearchResultSchema, {
      image: await imagePayload(input.uri),
      filters: input.filters,
    });
  }
  clearance(input: SearchRequest) {
    return this.search({ ...input, onSale: true });
  }
  async details(id: string) {
    return this.request(
      `/v1/shopping/products/${encodeURIComponent(id)}`,
      ProductSchema,
    );
  }
  compare(ids: string[]) {
    return this.request("/v1/shopping/compare", z.array(ProductSchema), {
      ids,
    });
  }
  async history(id: string) {
    const product = await this.details(id);
    return product.offer.price === null
      ? []
      : z.array(PriceSnapshotSchema).parse([
          {
            date: new Date().toISOString().slice(0, 10),
            price: product.offer.price,
            currency: product.offer.currency,
            checkedAt: product.checkedAt,
          },
        ]);
  }
  refreshProduct(id: string) {
    return this.request(
      `/v1/shopping/products/${encodeURIComponent(id)}/refresh`,
      ProductSchema,
      {},
    );
  }
  advice(id: string) {
    return this.request(
      `/v1/shopping/products/${encodeURIComponent(id)}/advice`,
      AdviceSchema,
      {},
    );
  }
  async trends() {
    return TrendsResultSchema.parse([]);
  }
}
