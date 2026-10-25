import { SharedPostPreview } from "../feed/SharedPostPreview";
import React, { memo, useMemo } from "react";
import { View, Pressable } from "react-native";
import { Row, Txt, Avatar, GarmentImage } from "../../components/ui";
import { ChatMessage, ChatTarget } from "../../models/chat";
import { theme as t } from "../../theme";
export const ChatMessageBubble = memo(function ChatMessageBubble({
  item,
  mine,
  name,
  target,
  onReply,
}: {
  item: ChatMessage;
  mine: boolean;
  name: string;
  target: ChatTarget;
  onReply: (reply: NonNullable<ChatMessage["replyTo"]>) => void;
}) {
  const imageContext = useMemo(
    () => ({ ...target, messageId: item.id }),
    [target, item.id],
  );
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "90%",
        width: item.attachment || item.post ? "90%" : undefined,
        gap: 4,
      }}
    >
      <Row>
        <Avatar name={name} size={24} />
        <Txt muted style={{ fontSize: 11 }}>
          {mine ? "You" : name} ·{" "}
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Txt>
      </Row>
      <View
        style={{
          gap: 10,
          padding: 14,
          borderRadius: t.radius.lg,
          backgroundColor: mine ? t.colors.sageLight : t.colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: t.colors.border,
        }}
      >
        {item.replyTo && (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: t.colors.sage,
              paddingLeft: 9,
            }}
          >
            <Txt muted numberOfLines={2} style={{ fontSize: 12 }}>
              ↳ {item.replyTo.preview}
            </Txt>
          </View>
        )}
        {!!item.text && <Txt>{item.text}</Txt>}
        {item.post && (
          <SharedPostPreview id={item.post.id} title={item.post.title} />
        )}
        {item.attachment && (
          <View style={{ gap: 8 }}>
            <Row
              style={{
                alignItems: "stretch",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {item.attachment.pieces.map((piece) => (
                <View
                  key={piece.id}
                  style={{
                    flexBasis: item.attachment!.pieces.length > 3 ? "45%" : 0,
                    flexGrow: 1,
                    minWidth: 55,
                    gap: 4,
                  }}
                >
                  <GarmentImage
                    image={piece.image}
                    chat={imageContext}
                    label={piece.name}
                    style={{ height: 115 }}
                  />
                  <Txt numberOfLines={2} style={{ fontSize: 10 }}>
                    {piece.name}
                  </Txt>
                </View>
              ))}
            </Row>
            <Txt style={{ fontWeight: "600" }}>{item.attachment.title}</Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${item.attachment.title}`}
              onPress={() =>
                onReply({
                  id: item.id,
                  preview: item.attachment!.title,
                })
              }
              style={{ minHeight: 32, justifyContent: "center" }}
            >
              <Txt style={{ fontSize: 12, color: t.colors.sage }}>
                Reply to this look ↗
              </Txt>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
});
