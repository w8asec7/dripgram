import { z } from "zod";
import { GarmentSchema, PublicProfileSchema } from "./index";
export const socialId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const StylePieceSchema = GarmentSchema.pick({
  name: true,
  category: true,
  primaryColor: true,
  pattern: true,
  fit: true,
  brand: true,
}).extend({
  description: z.string().max(500),
  subcategory: z.string().nullable(),
  styleTags: z.array(z.string()).max(8),
});
export type StylePiece = z.infer<typeof StylePieceSchema>;
export const PostPieceSchema = StylePieceSchema.extend({
  id: socialId,
  image: GarmentSchema.shape.image,
});
export const PostImageSchema = z.object({
  uri: z.string(),
  path: z.string().nullable(),
  version: socialId,
});
export const FashionPostSchema = z
  .object({
    id: socialId,
    ownerId: socialId,
    kind: z.enum(["outfit", "clothing"]).optional(),
    caption: z.string().trim().max(1000),
    visibility: z.enum(["public", "friends"]),
    image: PostImageSchema.nullable(),
    pieces: z.array(PostPieceSchema).max(6),
    outfitId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    sample: z.boolean(),
  })
  .refine(
    (p) => !!p.image || p.pieces.length > 0,
    "Choose a photo or a saved outfit.",
  );
export type FashionPost = z.infer<typeof FashionPostSchema>;
export const PostCommentSchema = z.object({
  id: socialId,
  authorId: socialId,
  text: z.string().trim().min(1).max(500),
  createdAt: z.string().datetime(),
});
export type PostComment = z.infer<typeof PostCommentSchema>;
export const PostDetailSchema = z.object({
  post: FashionPostSchema,
  creator: PublicProfileSchema.nullable(),
  likes: z.array(socialId),
  comments: z.array(PostCommentSchema),
  saved: z.boolean(),
});
export type PostDetail = z.infer<typeof PostDetailSchema>;
export const OutfitAnalysisSchema = z.object({
  pieces: z.array(StylePieceSchema).min(1).max(6),
  summary: z.string().max(300),
});
export const RemixProposalSchema = z.object({
  matches: z
    .array(
      z.object({
        sourceIndex: z.number().int().min(0).max(5),
        garmentId: socialId,
        explanation: z.string().max(240),
      }),
    )
    .max(6),
  missing: z
    .array(
      z.object({
        sourceIndex: z.number().int().min(0).max(5),
        query: z.string().min(2).max(200),
        reason: z.string().max(200),
      }),
    )
    .max(6),
  summary: z.string().max(400),
});
export const RemixResultSchema = RemixProposalSchema.extend({
  original: OutfitAnalysisSchema,
  source: z.enum(["meta", "sample"]),
  analysisSource: z.enum(["structured", "image", "sample"]),
  postId: socialId,
});
export type RemixResult = z.infer<typeof RemixResultSchema>;
export const BulkGarmentsSchema = z.object({
  garments: z.array(StylePieceSchema).min(1).max(20),
});
export const TextWardrobeInputSchema = z.object({
  text: z.string().trim().min(3).max(3000),
});
