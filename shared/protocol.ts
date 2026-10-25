import { z } from "zod";
import { categories, occasionTypes, OutfitItemSchema } from "../src/models";
export const ImagePayloadSchema = z.object({
  base64: z.string().min(16).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export const RecognitionSchema = z.object({
  name: z.string().min(2).max(90),
  category: z.enum(categories),
  subcategory: z.string().nullable(),
  silhouette: z.string(),
  texture: z.array(z.string()).max(5),
  garmentRegion: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })
    .nullable(),
  primaryColor: z.string(),
  secondaryColors: z.array(z.string()).max(5),
  pattern: z.string(),
  fit: z.string(),
  styleTags: z.array(z.string()).max(8),
  brand: z.string().nullable(),
  material: z.string().nullable(),
  season: z.array(z.string()).max(4),
  occasions: z.array(z.string()).max(8),
  description: z.string().max(500),
  searchKeywords: z.array(z.string()).max(6),
  uncertainFields: z.array(z.string()).max(12),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
});
export const OutfitProposalSchema = z.object({
  name: z.string().min(2).max(90),
  items: z.array(OutfitItemSchema).min(2).max(8),
  explanation: z.string().max(700),
});
export const RecommendRequestSchema = z.object({
  requiredGarmentId: z.string().min(1).max(128).optional(),
  occasionType: z.enum(occasionTypes),
  dressCode: z.string().max(100).default(""),
  color: z.string().max(50).optional(),
  style: z.string().max(100).optional(),
  notes: z.string().max(400).optional(),
  includeAccessories: z.boolean().default(false),
  layering: z.enum(["auto", "none", "layered"]).default("auto"),
  variation: z.number().int().nonnegative().max(1000).default(0),
  replaceRole: z
    .enum(["top", "bottom", "outerwear", "shoes", "accessory"])
    .optional(),
  currentItems: z.array(OutfitItemSchema).max(8).optional(),
  occasionId: z.string().max(128).optional(),
});
export const SyncResultSchema = z.object({
  path: z.string(),
  signedUrl: z.url(),
  expiresAt: z.number(),
  syncedAt: z.string(),
});
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }),
});
export const AdviceSchema = z.object({
  summary: z.string().max(700),
  matchingGarmentIds: z.array(z.string()).max(30),
  similarOwnedIds: z.array(z.string()).max(30),
  recommendation: z.enum(["use-owned", "consider", "skip"]),
});
export type Recognition = z.infer<typeof RecognitionSchema>;
