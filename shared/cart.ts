import { z } from "zod";
import { primaryCategories } from "../src/models";
export const CartSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        query: z.string().min(2).max(200),
        reason: z.string().max(200),
        group: z.enum(primaryCategories),
      }),
    )
    .min(1)
    .max(3),
  source: z.enum(["meta", "sample"]),
});
