import type { ShoppingTiming } from "../timing";
import { z } from "zod";
import { Config } from "../config";
import {
  ApiError,
  RequestCache,
  UsageMeter,
  hash,
  providerFetch,
} from "../core";
import {
  Product,
  ProductSchema,
  Category,
  categoryGroup,
} from "../../src/models";
import { SearchRequest, SearchResult } from "../../src/services/shopping";
const RowSchema = z
  .object({
    title: z.string(),
    source: z.string().optional(),
    product_id: z.string().optional(),
    product_link: z.string().optional(),
    link: z.string().optional(),
    direct_link: z.string().optional(),
    thumbnail: z.string().optional(),
    extracted_price: z.number().optional(),
    extracted_old_price: z.number().optional(),
    price: z
      .union([
        z.string(),
        z.object({
          value: z.string().optional(),
          extracted_value: z.number().optional(),
          currency: z.string().optional(),
        }),
      ])
      .optional(),
    old_price: z.string().optional(),
    delivery: z.string().optional(),
    second_hand_condition: z.string().optional(),
    rating: z.number().optional(),
    reviews: z.number().optional(),
    immersive_product_page_token: z.string().optional(),
  })
  .passthrough();
export function buildShoppingQuery(f: SearchRequest) {
  return (
    [
      /\b(men|women|mens|womens|unisex)[’']?s?\b/i.test(f.query)
        ? undefined
        : f.clothingMode === "women"
          ? "women’s"
          : f.clothingMode === "men"
            ? "men’s"
            : undefined,
      f.query,
      f.group === "Tops"
        ? "tops"
        : f.group === "Bottoms"
          ? "pants shorts"
          : f.group === "Shoes"
            ? "shoes"
            : undefined,
      f.color,
      f.style,
      f.fit,
      f.brand,
      f.size,
      f.occasion,
      f.category?.replace("t-shirt", "t shirt"),
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(" ")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .slice(0, 350) || "versatile clothing"
  );
}
const priceNumber = (v: string | undefined) =>
  v && /^\$[\d,.]+/.test(v) ? Number(v.replace(/[^\d.]/g, "")) : null;
export function inferListingCategory(name: string): Category | null {
  const title = name.toLowerCase();
  return /sneaker|shoe|boot|sandal/.test(title)
    ? "shoes"
    : /jacket|blazer|overcoat|windbreaker/.test(title)
      ? "jacket"
      : /hoodie|hooded sweatshirt/.test(title)
        ? "hoodie"
        : /sweater|cardigan|knit pullover/.test(title)
          ? "sweater"
          : /jeans/.test(title)
            ? "jeans"
            : /shorts/.test(title)
              ? "shorts"
              : /trouser|pants|chino/.test(title)
                ? "trousers"
                : /tank.?top/.test(title)
                  ? "tank-top"
                  : /t.?shirt|\btee\b/.test(title)
                    ? "t-shirt"
                    : /shirt|overshirt/.test(title)
                      ? "shirt"
                      : null;
}
export function normalizeProduct(
  row: unknown,
  filters: SearchRequest,
): Product | null {
  const parsed = RowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  const price =
    typeof r.price === "object"
      ? (r.price.extracted_value ?? null)
      : (r.extracted_price ?? priceNumber(r.price));
  const currency =
    typeof r.price === "object"
      ? r.price.currency || "USD"
      : typeof r.price === "string" && !r.price.startsWith("$")
        ? "UNKNOWN"
        : "USD";
  if (currency !== "USD") return null;
  const rawUrl = r.direct_link || r.link || r.product_link;
  let url: string | null = null;
  try {
    const u = new URL(rawUrl || "");
    if (u.protocol === "https:" || u.protocol === "http:") url = u.href;
  } catch {
    /* Missing provider URL. */
  }
  const image =
    r.thumbnail && /^https:\/\//.test(r.thumbnail) ? r.thumbnail : null;
  const old = r.extracted_old_price ?? priceNumber(r.old_price);
  const category = inferListingCategory(r.title);
  return ProductSchema.parse({
    id:
      "live-" +
      hash(
        (r.product_id || r.title) + "|" + (r.source || "") + "|" + (url || ""),
      ).slice(0, 24),
    name: r.title,
    category,
    color: null,
    brand: null,
    sizes: [],
    image,
    providerId: r.product_id || null,
    pageToken: r.immersive_product_page_token || null,
    rating: r.rating ?? null,
    reviewCount: r.reviews ?? null,
    offer: {
      retailer: r.source || null,
      price,
      originalPrice: old !== null && price !== null && old > price ? old : null,
      currency: "USD",
      url,
      shipping: r.delivery || null,
      condition: r.second_hand_condition || null,
    },
    similarity: null,
    matchType: "similar",
    compatibility: null,
    sample: false,
    checkedAt: new Date().toISOString(),
  });
}
export function filterLive(products: Product[], f: SearchRequest) {
  return products
    .map((product) =>
      product.sample
        ? product
        : { ...product, category: inferListingCategory(product.name) },
    )
    .filter(
      (p) =>
        (!f.group || !p.category || categoryGroup(p.category) === f.group) &&
        (!f.category || !p.category || p.category === f.category) &&
        (f.maxPrice === undefined ||
          (p.offer.price !== null && p.offer.price <= f.maxPrice)) &&
        (f.minPrice === undefined ||
          (p.offer.price !== null && p.offer.price >= f.minPrice)) &&
        (!f.retailer ||
          p.offer.retailer?.toLowerCase().includes(f.retailer.toLowerCase())) &&
        (!f.onSale || p.offer.originalPrice !== null),
    )
    .sort((a, b) =>
      f.sort === "price"
        ? (a.offer.price ?? Infinity) - (b.offer.price ?? Infinity)
        : f.sort === "discount"
          ? (b.offer.originalPrice && b.offer.price !== null
              ? 1 - b.offer.price / b.offer.originalPrice
              : 0) -
            (a.offer.originalPrice && a.offer.price !== null
              ? 1 - a.offer.price / a.offer.originalPrice
              : 0)
          : listingRelevance(b, f.query) - listingRelevance(a, f.query),
    );
}
function listingRelevance(product: Product, query: string) {
  const words = [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 2 &&
            ![
              "men",
              "mens",
              "women",
              "womens",
              "and",
              "the",
              "with",
              "for",
            ].includes(w),
        ),
    ),
  ];
  const title = product.name.toLowerCase();
  return words.reduce(
    (score, word) =>
      score +
      (title.includes(word)
        ? /^(white|black|blue|pink|beige|red|green|grey|navy|cream)$/.test(word)
          ? 5
          : 1
        : 0),
    0,
  );
}
export class SerpProvider {
  constructor(
    private config: Config,
    private cache: RequestCache,
    private usage: UsageMeter,
  ) {}
  private async request(params: Record<string, string>) {
    if (!this.config.SERPAPI_API_KEY)
      throw new ApiError(
        503,
        "SHOPPING_UNCONFIGURED",
        "Live shopping is not configured on the backend.",
      );
    await this.usage.count("serp", this.config.MAX_SERP_CALLS_PER_DAY);
    const url = new URL("https://serpapi.com/search.json");
    Object.entries({ ...params, api_key: this.config.SERPAPI_API_KEY }).forEach(
      ([k, v]) => url.searchParams.set(k, v),
    );
    const raw = await providerFetch(
      url.href,
      {},
      this.config.PROVIDER_TIMEOUT_MS,
    );
    const parsed = z
      .object({
        error: z.string().optional(),
        shopping_results: z.array(z.unknown()).optional(),
        visual_matches: z.array(z.unknown()).optional(),
        products: z.array(z.unknown()).optional(),
        product_results: z.unknown().optional(),
      })
      .passthrough()
      .parse(raw);
    if (parsed.error)
      throw new ApiError(
        502,
        "SEARCH_PROVIDER",
        "The search provider could not return results. Try a broader query or check provider credits.",
      );
    return parsed;
  }
  search(
    f: SearchRequest,
    refresh = false,
    timing?: ShoppingTiming,
  ): Promise<SearchResult> {
    // Cache unfiltered provider rows by the actual outbound query. Price/sale/sort are local filters.
    const query = buildShoppingQuery(f);
    const key = query;
    return this.cache
      .get<SearchResult>(
        `shopping:raw-v2:${key}:${refresh ? Math.floor(Date.now() / 60000) : "normal"}`,
        refresh ? 60000 : 30 * 60000,
        async () => {
          const providerStart = performance.now();
          const raw = await this.request({
            engine: "google_shopping",
            q: query,
            gl: "us",
            hl: "en",
          });
          timing?.add("provider", performance.now() - providerStart);
          timing?.add("provider_calls", 1);
          const normalizeStart = performance.now();
          const rows = raw.shopping_results || [];
          const products = rows
            .map((r) => normalizeProduct(r, f))
            .filter((p): p is Product => !!p)
            .slice(0, 60);
          timing?.add("normalize", performance.now() - normalizeStart);
          return {
            products,
            partial: products.length < rows.length,
            source: "live",
            message:
              "Live Google Shopping results via SerpApi. Prices and availability may change; verify at checkout.",
            checkedAt: new Date().toISOString(),
          };
        },
      )
      .then((result) => ({
        ...result,
        products: filterLive(result.products, f),
      }));
  }
  visual(
    uid: string,
    imageHash: string,
    getSignedUrl: () => Promise<string>,
    f: SearchRequest,
  ): Promise<SearchResult> {
    return this.cache.get(
      `lens:${uid}:${imageHash}:${JSON.stringify(f)}`,
      30 * 60000,
      async () => {
        const url = await getSignedUrl();
        const raw = await this.request({
          engine: "google_lens",
          url,
          country: "us",
          hl: "en",
        });
        const rows =
          raw.visual_matches || raw.products || raw.shopping_results || [];
        const products = rows
          .map((r) => normalizeProduct(r, f))
          .filter((p): p is Product => !!p);
        return {
          products: filterLive(products, f),
          partial: products.length < rows.length,
          source: "live",
          message:
            "Visual matches via Google Lens. Similarity does not establish an exact product match.",
          checkedAt: new Date().toISOString(),
        };
      },
    );
  }
  async merchant(product: Product): Promise<Product> {
    if (
      !product.pageToken ||
      (product.offer.url &&
        !new URL(product.offer.url).hostname.endsWith("google.com"))
    )
      return product;
    return this.cache.get(`merchant:${product.id}`, 60 * 60000, async () => {
      try {
        const raw = await this.request({
          engine: "google_immersive_product",
          page_token: product.pageToken!,
          gl: "us",
          hl: "en",
        });
        const result = raw.product_results as
          | {
              stores?: {
                link?: string;
                name?: string;
                extracted_price?: number;
                price?: string;
              }[];
            }
          | undefined;
        const store = result?.stores?.find(
          (s) =>
            s.link &&
            (!product.offer.retailer ||
              s.name?.toLowerCase() === product.offer.retailer.toLowerCase()),
        );
        if (!store?.link) return product;
        const u = new URL(store.link);
        if (!["https:", "http:"].includes(u.protocol)) return product;
        return { ...product, offer: { ...product.offer, url: u.href } };
      } catch {
        return product;
      }
    });
  }
}
