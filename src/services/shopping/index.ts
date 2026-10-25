import { z } from "zod";
import {
  Product,
  categoryGroup,
  ProductSchema,
  PriceSnapshotSchema,
  ShoppingSearchSchema,
} from "../../models";
import { products } from "../../mocks/seed";
export const SearchRequestSchema = ShoppingSearchSchema.omit({
  id: true,
  ownerId: true,
  name: true,
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export const SearchResultSchema = z.object({
  products: z.array(ProductSchema),
  partial: z.boolean(),
  source: z.enum(["sample", "live"]),
  message: z.string().nullable(),
  checkedAt: z.string().optional(),
  cached: z.boolean().optional(),
});
export const VisualSearchRequestSchema = z.object({
  uri: z.string().min(1),
  filters: SearchRequestSchema,
});
export const TrendsResultSchema = z.array(
  z.object({
    query: z.string(),
    interest: z.number().min(0).max(100),
    sample: z.boolean(),
  }),
);
export type SearchResult = z.infer<typeof SearchResultSchema>;
export interface ShoppingService {
  search(input: SearchRequest): Promise<SearchResult>;
  visualSearch(input: {
    uri: string;
    filters: SearchRequest;
  }): Promise<SearchResult>;
  clearance(input: SearchRequest): Promise<SearchResult>;
  details(id: string): Promise<Product | null>;
  compare(ids: string[]): Promise<Product[]>;
  history(id: string): Promise<z.infer<typeof PriceSnapshotSchema>[]>;
  refreshProduct?(id: string): Promise<Product>;
  advice?(
    id: string,
  ): Promise<
    import("zod").infer<typeof import("../../../shared/protocol").AdviceSchema>
  >;
  trends(
    query: string,
  ): Promise<{ query: string; interest: number; sample: boolean }[]>;
}
export const discount = (p: Product) =>
  p.offer.price !== null &&
  p.offer.originalPrice &&
  p.offer.originalPrice > p.offer.price
    ? Math.round((1 - p.offer.price / p.offer.originalPrice) * 100)
    : null;
export const watchReached = (price: number, target: number) =>
  Number.isFinite(price) && Number.isFinite(target) && price <= target;
export function filterProducts(
  all: Product[],
  input: SearchRequest,
): Product[] {
  const p = SearchRequestSchema.parse(input);
  const words = p.query.toLowerCase().split(/\s+/).filter(Boolean);
  const result = all.filter(
    (x) =>
      (!words.length ||
        words.every((w) =>
          `${x.name} ${x.category || ""} ${x.color || ""} ${x.brand || ""}`
            .toLowerCase()
            .includes(w),
        )) &&
      (!p.category || x.category === p.category) &&
      (!p.group || categoryGroup(x.category || "") === p.group) &&
      ((!p.maxPrice && p.maxPrice !== 0) ||
        (x.offer.price !== null && x.offer.price <= p.maxPrice!)) &&
      (!p.minPrice ||
        (x.offer.price !== null && x.offer.price >= p.minPrice)) &&
      (!p.color || x.color?.toLowerCase() === p.color.toLowerCase()) &&
      (!p.brand || x.brand?.toLowerCase().includes(p.brand.toLowerCase())) &&
      (!p.retailer ||
        x.offer.retailer?.toLowerCase().includes(p.retailer.toLowerCase())) &&
      (!p.size || x.sizes.includes(p.size)) &&
      (!p.onSale || discount(x) !== null),
  );
  return result.sort((a, b) =>
    p.sort === "price"
      ? (a.offer.price ?? Infinity) - (b.offer.price ?? Infinity)
      : p.sort === "discount"
        ? (discount(b) || 0) - (discount(a) || 0)
        : (b.similarity ?? 0) - (a.similarity ?? 0),
  );
}
export class ShoppingServiceError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "rate-limit" | "unexpected",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ShoppingServiceError";
  }
}
export class MockShoppingService implements ShoppingService {
  constructor(
    private scenario:
      "normal" | "partial" | "offline" | "rate-limit" = "normal",
  ) {}
  async search(input: SearchRequest) {
    if (this.scenario === "offline")
      throw new ShoppingServiceError(
        "Couldn’t load sample results. Check your connection and try again.",
        "offline",
      );
    if (this.scenario === "rate-limit")
      throw new ShoppingServiceError(
        "Search is temporarily limited. Wait 60 seconds and retry.",
        "rate-limit",
        60,
      );
    const found = filterProducts(products, input);
    return SearchResultSchema.parse({
      products: this.scenario === "partial" ? found.slice(0, 3) : found,
      partial: this.scenario === "partial",
      source: "sample",
      message:
        this.scenario === "partial"
          ? "Some sample results are unavailable. Showing the results we could load."
          : "Sample listings and prices. No live search or price monitoring.",
    });
  }
  async visualSearch(input: { uri: string; filters: SearchRequest }) {
    VisualSearchRequestSchema.parse(input);
    const result = await this.search(input.filters);
    return {
      ...result,
      message:
        "Sample visual matches. Your photo was not analyzed by a live service.",
    };
  }
  clearance(input: SearchRequest) {
    return this.search({ ...input, onSale: true });
  }
  async details(id: string) {
    const product = products.find((p) => p.id === id);
    return product ? ProductSchema.parse(product) : null;
  }
  async compare(ids: string[]) {
    return z
      .array(ProductSchema)
      .parse(products.filter((p) => ids.includes(p.id)));
  }
  async history(id: string) {
    const p = await this.details(id);
    if (!p) return [];
    return z.array(PriceSnapshotSchema).parse([
      {
        date: "2026-10-10",
        price: p.offer.originalPrice || p.offer.price || 0,
      },
      { date: "2026-10-17", price: (p.offer.price || 0) + 5 },
      { date: "2026-10-24", price: p.offer.price || 0 },
    ]);
  }
  async trends(query: string) {
    return TrendsResultSchema.parse([{ query, interest: 68, sample: true }]);
  }
}
