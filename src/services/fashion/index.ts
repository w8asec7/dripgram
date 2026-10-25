import { z } from "zod";
import { User, AppData } from "../../models";
import {
  FashionPost,
  BulkGarmentsSchema,
  RemixResultSchema,
  TextWardrobeInputSchema,
  OutfitAnalysisSchema,
} from "../../models/posts";
import { apiRequest, imagePayload } from "../api";
import { demoApiRequest, syncDemoWardrobe } from "../demoLive";
import { sampleRemix, validateRemix } from "../../features/feed/domain";
export function fashionService(user: User, data: AppData, live: boolean) {
  const call = user.mode === "demo" ? demoApiRequest : apiRequest;
  return {
    async extract(text: string) {
      const input = TextWardrobeInputSchema.parse({ text });
      if (!live)
        throw new Error(
          "AI list extraction requires live services. Use Explore demo or sign in, or add pieces manually by photo/text fields.",
        );
      return call("/v1/wardrobe/extract", BulkGarmentsSchema, input);
    },
    async analyze(post: FashionPost) {
      if (!live) {
        if (!post.pieces.length)
          throw new Error(
            "Photo understanding needs live Meta services. Reconnect or choose a sample post.",
          );
        return {
          original: {
            pieces: post.pieces,
            kind: post.kind,
            summary: "Curated sample garment observations",
          },
          source: "sample" as const,
        };
      }
      return call(
        "/v1/posts/analyze",
        z.object({
          original: OutfitAnalysisSchema,
          analysisSource: z.enum(["structured", "image"]),
          source: z.literal("meta"),
        }),
        {
          postId: post.id,
          ...(user.mode === "demo"
            ? {
                demo: {
                  pieces: post.pieces,
                  kind: post.kind,
                  version: post.image?.version || "structured-v1",
                  ...(!post.pieces.length && post.image
                    ? { image: await imagePayload(post.image.uri) }
                    : {}),
                },
              }
            : {}),
        },
      );
    },
    async remix(post: FashionPost, variation = 0) {
      if (!live) {
        if (!post.pieces.length)
          throw new Error(
            "Photo outfit analysis needs live Meta services. Choose a sample collage or reconnect.",
          );
        return sampleRemix(post.pieces, data.garments, user.id, post.id);
      }
      if (user.mode === "demo") await syncDemoWardrobe();
      const result = await call("/v1/ai/remix", RemixResultSchema, {
        postId: post.id,
        variation,
        ...(user.mode === "demo"
          ? {
              demo: {
                pieces: post.pieces,
                kind: post.kind,
                version: post.image?.version || "structured-v1",
                ...(!post.pieces.length && post.image
                  ? { image: await imagePayload(post.image.uri) }
                  : {}),
              },
            }
          : {}),
      });
      return validateRemix(result, data.garments, user.id);
    },
    async transcribe(base64: string) {
      if (!live)
        throw new Error(
          "Voice transcription requires live Meta services. Text entry is available without microphone access.",
        );
      return call(
        "/v1/wardrobe/transcribe",
        z.object({ text: z.string(), durationMs: z.number() }),
        { base64 },
      );
    },
  };
}
