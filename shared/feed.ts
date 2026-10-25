import { z } from "zod";
import { ProductSchema, ShoppingSearchSchema } from "../src/models";
export const FeedRequestSchema = z.object({
  mode: z.enum(["discover", "complete", "clearance"]),
  filters: ShoppingSearchSchema.omit({
    id: true,
    ownerId: true,
    name: true,
  }).default({ query: "" }),
  page: z.number().int().min(0).max(23).default(0),
  refresh: z.boolean().default(false),
  rotation: z.number().int().min(0).max(23).default(0),
});
export const FeedPageSchema = z.object({
  products: z.array(ProductSchema),
  nextPage: z.number().int().nullable(),
  productReasons: z.record(z.string(), z.string()).optional(),
  reason: z.string(),
  query: z.string(),
  source: z.enum(["sample", "live"]),
  planSource: z.enum(["rules", "meta"]),
  checkedAt: z.string(),
  message: z.string(),
});
export type FeedRequest = z.infer<typeof FeedRequestSchema>;
export type FeedPage = z.infer<typeof FeedPageSchema>;
export function uniqueProducts<
  T extends {
    id: string;
    providerId?: string | null;
    sample?: boolean;
    offer: { url: string | null; retailer: string | null };
  },
>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((p) => {
    const key = p.sample
      ? `sample:${p.id}`
      : p.providerId
        ? `provider:${p.providerId}`
        : p.offer.url || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Stable round-robin within a new batch; never reshuffle already-rendered pages. */
export function interleaveProducts<T extends { category: string | null }>(
  items: T[],
): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category || "other";
    const bucket = buckets.get(key) || [];
    bucket.push(item);
    buckets.set(key, bucket);
  }
  const result: T[] = [];
  while ([...buckets.values()].some((b) => b.length)) {
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (next) result.push(next);
    }
  }
  return result;
}
