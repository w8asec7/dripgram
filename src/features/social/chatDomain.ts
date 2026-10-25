import { AppData, Garment, isoNow, makeId } from "../../models";
import {
  ChatAttachmentSchema,
  ChatAttachment,
  ChatMessageSchema,
  ChatMessage,
  ChatTarget,
} from "../../models/chat";
export function assertChatMember(
  data: AppData,
  uid: string,
  target: ChatTarget,
) {
  const members =
    target.kind === "group"
      ? data.groups.find((g) => g.id === target.id)?.memberIds
      : data.occasions.find((o) => o.id === target.id)?.participantIds;
  if (!members?.includes(uid))
    throw new Error(
      "This conversation is private. Ask a member to invite you.",
    );
}
export function attachmentFromGarments(
  garments: Garment[],
  uid: string,
  ids: string[],
  title: string,
  outfitId: string | null = null,
): ChatAttachment {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new Error("Choose each piece once.");
  const pieces = unique.map((id) => {
    const g = garments.find((g) => g.id === id && g.ownerId === uid);
    if (!g) throw new Error("You can share only your own selected clothes.");
    return {
      id: g.id,
      name: g.name,
      category: g.category,
      primaryColor: g.primaryColor,
      image: g.image,
    };
  });
  // This is a snapshot, with no wear command, availability mutation or laundry deduction.
  return ChatAttachmentSchema.parse({ title, outfitId, pieces });
}
export function createChatMessage(
  uid: string,
  text: string,
  attachment: ChatAttachment | null = null,
  replyTo: ChatMessage["replyTo"] = null,
  post?: ChatMessage["post"],
): ChatMessage {
  return ChatMessageSchema.parse({
    id: makeId("message"),
    authorId: uid,
    text,
    createdAt: isoNow(),
    attachment,
    replyTo,
    ...(post ? { post } : {}),
  });
}
