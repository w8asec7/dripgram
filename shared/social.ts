import { z } from "zod";
import { ImagePayloadSchema } from "./protocol";
import {
  socialId,
  PostPieceSchema,
  PostImageSchema,
} from "../src/models/posts";
export const RemixRequestSchema = z.object({
  postId: socialId,
  variation: z.number().int().min(0).max(100).default(0),
  demo: z
    .object({
      pieces: z.array(PostPieceSchema).max(8),
      kind: z.enum(["outfit", "clothing"]).optional(),
      image: ImagePayloadSchema.optional(),
      version: socialId,
    })
    .optional(),
});
export const PostUploadSchema = z.object({
  postId: socialId,
  version: socialId,
  image: ImagePayloadSchema,
});
export const PostSignSchema = z.object({
  postId: socialId,
  garmentId: socialId.optional(),
});
export const PostDraftImageSchema = PostImageSchema;
