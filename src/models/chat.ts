import { z } from "zod";
import { SharedPieceSchema } from "./index";
export const ChatTargetSchema = z.object({
  kind: z.enum(["group", "occasion"]),
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
});
export const ChatAttachmentSchema = z.object({
  title: z.string().trim().min(2).max(90),
  outfitId: z.string().max(128).nullable(),
  pieces: z.array(SharedPieceSchema).min(1).max(8),
});
export const ChatMessageSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    authorId: z.string().min(1),
    text: z.string().trim().max(2000),
    createdAt: z.string().datetime(),
    attachment: ChatAttachmentSchema.nullable(),
    post: z
      .object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        title: z.string().min(1).max(140),
      })
      .nullable()
      .optional(),
    replyTo: z
      .object({ id: z.string().max(128), preview: z.string().max(140) })
      .nullable(),
  })
  .refine(
    (m) => !!m.text || !!m.attachment || !!m.post,
    "Write a message or choose an outfit.",
  );
export type ChatTarget = z.infer<typeof ChatTargetSchema>;
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const chatPath = (target: ChatTarget) => {
  const { kind, id } = ChatTargetSchema.parse(target);
  return `${kind === "group" ? "styleGroups" : "occasions"}/${id}/messages`;
};
