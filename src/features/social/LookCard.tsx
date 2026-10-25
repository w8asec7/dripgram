import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SharedLook } from "../../models";
import {
  Card,
  Row,
  Avatar,
  Txt,
  Button,
  GarmentImage,
  Badge,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { theme as t } from "../../theme";
export function LookPreview({ look }: { look: SharedLook }) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.colors.sageLight,
        borderRadius: t.radius.lg,
        overflow: "hidden",
        height: 240,
      }}
    >
      {look.pieces.map((piece) => (
        <GarmentImage
          key={piece.id}
          image={piece.image}
          lookId={look.id}
          label={piece.name}
          style={{ flex: 1, borderRadius: 0, backgroundColor: "transparent" }}
        />
      ))}
    </View>
  );
}
export function LookCard({
  look,
  compact = false,
}: {
  look: SharedLook;
  compact?: boolean;
}) {
  const { data, user, execute, busy } = useApp();
  const author = data?.directory.find((p) => p.id === look.ownerId);
  return (
    <Card>
      <Row>
        <Avatar name={author?.displayName || "Friend"} size={38} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: "600" }}>
            {author?.displayName || "Friend"}
          </Txt>
          <Txt muted style={{ fontSize: 11 }}>
            {look.groupId
              ? data?.groups.find((g) => g.id === look.groupId)?.name ||
                "Shared group"
              : "Selected friends"}{" "}
            · {new Date(look.createdAt).toLocaleDateString()}
          </Txt>
        </View>
        <Badge>SHARED LOOK</Badge>
      </Row>
      <LookPreview look={look} />
      <Txt serif style={{ fontSize: t.type.title }}>
        {look.title}
      </Txt>
      <Txt muted style={{ fontSize: 12 }}>
        {look.pieces.map((p) => p.name).join(" + ")}
      </Txt>
      <Row>
        <Button
          title={`${look.reactions.includes(user?.id || "") ? "Liked ✓" : "Like"} · ${look.reactions.length}`}
          icon="heart"
          variant="ghost"
          disabled={busy}
          onPress={() => ignore(execute({ type: "look.react", id: look.id }))}
        />
        {!compact && (
          <Button
            title={`Opinions · ${look.comments.length}`}
            icon="message-circle"
            variant="ghost"
            onPress={() => router.push(`/social/look/${look.id}`)}
          />
        )}
      </Row>
      {!compact &&
        look.comments.slice(-1).map((c) => (
          <Txt key={c.id} muted style={{ fontSize: 13 }}>
            <Txt style={{ fontWeight: "600", fontSize: 13 }}>
              {data?.directory
                .find((p) => p.id === c.authorId)
                ?.displayName.split(" ")[0] || "Friend"}
              :{" "}
            </Txt>
            {c.text}
          </Txt>
        ))}
    </Card>
  );
}
