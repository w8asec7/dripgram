import type { ShoppingTiming } from "../timing";
import { z } from "zod";
import {
  FeedPageSchema,
  FeedRequest,
  uniqueProducts,
  interleaveProducts,
} from "../../shared/feed";
import {
  Garment,
  Profile,
  Product,
  categories,
  categoryGroup,
} from "../../src/models";
import { wardrobeInsights } from "../../src/services/ai";
import { RequestCache, hash } from "../core";
import { MetaProvider } from "./meta";
import { SerpProvider } from "./serp";
const PlanSchema = z.object({
  suggestions: z
    .array(
      z.object({
        query: z.string().min(2).max(150),
        reason: z.string().max(180),
        category: z.enum(categories).nullable(),
      }),
    )
    .min(1)
    .max(6),
});
export function feedQueries(
  garments: Garment[],
  profile: Profile,
  mode: FeedRequest["mode"],
) {
  const gaps = wardrobeInsights(garments)
    .filter((i) => i.kind === "gap")
    .map((i) => ({
      query: i.query,
      reason: i.explanation,
      category: i.category || null,
    }));
  const topColors = new Set(
    garments
      .filter((g) => ["shirt", "t-shirt"].includes(g.category))
      .map((g) => g.primaryColor.toLowerCase()),
  );
  const neutral = topColors.has("beige") ? "navy" : "beige";
  const style = profile.preferences.styles[0] || "casual";
  const fallback = [
    {
      query: `${style} everyday clothing shirts pants shoes`,
      reason: "A balanced starting point in your preferred style.",
      category: null,
    },
    {
      query: `${neutral} relaxed trousers`,
      reason: `A ${neutral} bottom adds another palette to explore with your tops.`,
      category: "trousers" as const,
    },
    {
      query: `${style} oversized t shirt`,
      reason: "A top to explore in your preferred style.",
      category: "t-shirt" as const,
    },
    {
      query: "neutral everyday sneakers",
      reason: "A footwear option alongside the clothing in your closet.",
      category: "shoes" as const,
    },
    {
      query: "blue straight leg jeans",
      reason: "Explore another everyday bottom alongside your existing pieces.",
      category: "jeans" as const,
    },
    {
      query: `${style} lightweight jacket`,
      reason:
        "A light layer for changing weather; check your closet before buying.",
      category: "jacket" as const,
    },
    {
      query: `${style} oversized t shirt`,
      reason: "A different top to consider within your preferred style.",
      category: "t-shirt" as const,
    },
    {
      query: `${style} overshirt`,
      reason: "Explore a versatile shirt layer.",
      category: "shirt" as const,
    },
    {
      query: "relaxed cotton hoodie",
      reason: "An optional casual layer for cooler days.",
      category: "hoodie" as const,
    },
  ];
  const more = [
    ["white cotton shirts", "shirt"],
    ["black relaxed fit jeans", "jeans"],
    ["sage zip hoodie", "hoodie"],
    ["neutral knit sweater", "sweater"],
    ["navy lightweight trousers", "trousers"],
    ["cotton chino shorts", "shorts"],
    ["olive overshirt jacket", "jacket"],
    ["burgundy heavyweight t shirt", "t-shirt"],
    ["grey wide leg trousers", "trousers"],
    ["denim shirt", "shirt"],
    ["beige quarter zip sweater", "sweater"],
    ["black windbreaker jacket", "jacket"],
    ["striped cotton t shirt", "t-shirt"],
    ["brown corduroy pants", "trousers"],
    ["light blue casual shirt", "shirt"],
    ["oatmeal pullover hoodie", "hoodie"],
    ["ecru straight leg jeans", "jeans"],
    ["green cotton shorts", "shorts"],
  ].map(([query, category]) => ({
    query: `${style} ${query}`,
    category: category as Garment["category"],
    reason:
      "Another option in your preferred style. Check the details and your existing wardrobe before buying.",
  }));
  const list =
    mode === "complete"
      ? [...gaps, ...fallback, ...more]
      : [...fallback, ...more];
  const seen = new Set<string>();
  return list
    .filter((q) => {
      if (seen.has(q.query)) return false;
      seen.add(q.query);
      return true;
    })
    .slice(0, 24);
}
export class ShoppingFeedProvider {
  constructor(
    private cache: RequestCache,
    private meta: MetaProvider,
    private serp: SerpProvider,
  ) {}
  async page(
    uid: string,
    input: FeedRequest,
    garments: Garment[],
    profile: Profile,
    shoppingContext: Product[] = [],
    timing?: ShoppingTiming,
  ) {
    const planStart = performance.now();
    const inventory = garments.map((g) => ({
      id: g.id,
      category: g.category,
      color: g.primaryColor,
      styles: g.styleTags,
    }));
    const planKey = hash(
      JSON.stringify({
        uid,
        inventory,
        preferences: profile.preferences,
        mode: input.mode,
        shoppingContext: shoppingContext.map((p) => ({
          id: p.id,
          category: p.category,
          color: p.color,
        })),
      }),
    );
    const plan = await this.cache.get(
      "feed-plan:social-v4:" + planKey,
      30 * 60000,
      async () => {
        if (input.mode === "complete")
          try {
            const result = await this.meta.structured(
              uid,
              "shopping-plan",
              JSON.stringify({
                task: "Suggest 4-6 distinct useful garment shopping searches for actual wardrobe gaps or complementary colors. Shopping focus. No invented ownership, counts, compatibility claims, discounts or prices. Concise search query and reason only. Avoid buying duplicates.",
                inventory,
                preferences: profile.preferences,
              }),
              PlanSchema,
            );
            const queries = [
              ...result.suggestions,
              ...feedQueries(garments, profile, input.mode),
            ];
            const seen = new Set<string>();
            return {
              queries: queries
                .filter((q) => {
                  if (seen.has(q.query.toLowerCase())) return false;
                  seen.add(q.query.toLowerCase());
                  return true;
                })
                .slice(0, 24),
              source: "meta" as const,
            };
          } catch {
            /* Usable transparent rules fallback, without extra provider retries. */
          }
        return {
          queries: [
            ...shoppingContext.slice(0, 2).flatMap((product) => {
              const group = categoryGroup(product.category || "");
              return group
                ? [
                    {
                      query:
                        group === "Bottoms"
                          ? `${profile.preferences.styles[0] || "casual"} neutral shirt hoodie`
                          : `${profile.preferences.styles[0] || "casual"} versatile trousers jeans`,
                      category:
                        group === "Bottoms"
                          ? ("shirt" as const)
                          : ("trousers" as const),
                      reason:
                        "A complementary category to explore with a product in your saved shopping collection.",
                    },
                  ]
                : [];
            }),
            ...feedQueries(garments, profile, input.mode),
          ]
            .filter(
              (query, index, list) =>
                list.findIndex(
                  (item) =>
                    item.query.toLowerCase() === query.query.toLowerCase(),
                ) === index,
            )
            .slice(0, 24),
          source: "rules" as const,
        };
      },
    );
    timing?.add("plan", performance.now() - planStart);
    const matching = input.filters.group
      ? plan.queries.filter(
          (q) =>
            q.category && categoryGroup(q.category) === input.filters.group,
        )
      : plan.queries;
    const explicit = input.filters.query.trim();
    const contextual = explicit
      ? [
          "",
          "affordable",
          "similar styles",
          "relaxed fit",
          "new arrivals",
          "everyday",
          "lightweight",
          "classic",
        ].map((suffix) => ({
          query: [explicit, suffix].filter(Boolean).join(" "),
          reason: "Selected to match your inspiration and search.",
          category: input.filters.category || null,
        }))
      : null;
    const available =
      contextual ||
      (matching.length
        ? matching
        : [
            {
              query:
                input.filters.group === "Shoes"
                  ? "everyday shoes"
                  : input.filters.group || "clothing",
              reason: "Selected clothing group.",
              category: null,
            },
          ]);
    const offset = (input.rotation * 3) % available.length;
    const ordered = [...available.slice(offset), ...available.slice(0, offset)];
    // Clearance first paint must not wait for three unrelated retailer searches.
    // Later queries arrive on scroll, with each provider search still cached.
    const batchSize = input.mode === "clearance" || input.page === 0 ? 1 : 3;
    const batchStart =
      input.mode === "clearance"
        ? input.page
        : input.page === 0
          ? 0
          : 1 + (input.page - 1) * 3;
    const batch = ordered.slice(batchStart, batchStart + batchSize);
    if (!batch.length)
      return FeedPageSchema.parse({
        products: [],
        nextPage: null,
        reason: "You have reached these selections.",
        query: "",
        source: "live",
        planSource: plan.source,
        checkedAt: new Date().toISOString(),
        message: "Pull to refresh or change filters to explore more.",
      });
    const searchesStart = performance.now();
    const responses = await Promise.allSettled(
      batch.map(async (suggestion) => {
        const filters = {
          ...input.filters,
          clothingMode:
            input.filters.clothingMode ??
            profile.preferences.clothingMode ??
            "men",
          query: [
            suggestion.query,
            input.mode === "clearance" ? "sale clearance" : "",
          ]
            .filter(Boolean)
            .join(" "),
          category: input.filters.category || suggestion.category || undefined,
          maxPrice:
            input.filters.maxPrice ??
            (input.mode === "complete"
              ? profile.preferences.budget
              : undefined),
          onSale: input.mode === "clearance" || input.filters.onSale,
        };
        const result = await this.serp.search(filters, input.refresh, timing);
        return { ...result, reason: suggestion.reason, query: filters.query };
      }),
    );
    timing?.add("search_wall", performance.now() - searchesStart);
    const normalizeStart = performance.now();
    const successes = responses.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    if (!successes.length) {
      const failure = responses.find((r) => r.status === "rejected");
      throw failure?.status === "rejected"
        ? failure.reason
        : new Error("No shopping results.");
    }
    const products = interleaveProducts(
      uniqueProducts(successes.flatMap((r) => r.products)),
    );
    timing?.add("merge", performance.now() - normalizeStart);
    return FeedPageSchema.parse({
      products,
      nextPage:
        batchStart + batchSize < available.length ? input.page + 1 : null,
      reason:
        input.mode === "complete"
          ? "Personalized additions selected around your wardrobe."
          : "Explore a wider mix of colors, cuts and clothing categories.",
      productReasons: Object.fromEntries(
        successes.flatMap((r) => r.products.map((p) => [p.id, r.reason])),
      ),
      query: successes.map((r) => r.query).join(" | "),
      source: "live",
      planSource: plan.source,
      checkedAt: successes[0].checkedAt || new Date().toISOString(),
      message: responses.some((r) => r.status === "rejected")
        ? "Some searches were unavailable. Showing the products that loaded."
        : input.mode === "clearance"
          ? "Only verified original/current-price discounts."
          : "Live similar listings. Verify prices and availability with the retailer.",
    });
  }
}
