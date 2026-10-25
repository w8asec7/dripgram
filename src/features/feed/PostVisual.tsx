import { GarmentFallback } from "../../components/GarmentFallback";
import React, { useEffect, useState, useRef } from "react";
import { Image } from "expo-image";
import { View, ActivityIndicator } from "react-native";
import { FashionPost } from "../../models/posts";
import { GarmentImage, Txt, IconButton } from "../../components/ui";
import { apiRequest } from "../../services/api";
import { SyncResultSchema } from "../../../shared/protocol";
import { theme as t } from "../../theme";
export function PostVisual({
  post,
  compact = false,
  square = false,
  editorial = false,
}: {
  post: FashionPost;
  compact?: boolean;
  square?: boolean;
  editorial?: boolean;
}) {
  return post.image ? (
    <PostPhoto
      post={post}
      compact={compact}
      square={square}
      editorial={editorial}
    />
  ) : (
    <View
      accessibilityLabel="Shared outfit collage"
      style={{
        ...(square ? { aspectRatio: 1 } : { height: compact ? 150 : 340 }),
        backgroundColor: t.colors.sand,
        borderRadius: t.radius.lg,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 8,
      }}
    >
      {post.pieces.map((piece) => (
        <View
          key={piece.id}
          style={{
            flex: 1,
            alignSelf: "stretch",
            gap: 8,
          }}
        >
          <PostPhoto
            post={post}
            pieceId={piece.id}
            compact={compact || square}
            square={square}
          />
          {!square && (
            <Txt
              numberOfLines={2}
              style={{ fontSize: 11, textAlign: "center" }}
            >
              {piece.name}
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}
function PostPhoto({
  post,
  pieceId,
  compact,
  square = false,
  editorial = false,
}: {
  post: FashionPost;
  pieceId?: string;
  compact: boolean;
  square?: boolean;
  editorial?: boolean;
}) {
  const renewed = useRef(false);
  const image = pieceId
    ? post.pieces.find((p) => p.id === pieceId)?.image
    : null;
  const local = pieceId ? image?.uri : post.image?.uri;
  const cloud = pieceId
    ? image?.syncStatus === "synced" && !!image?.storagePath
    : !!post.image?.path;
  const [uri, setUri] = useState(cloud ? undefined : local),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!cloud) return;
    void apiRequest("/v1/posts/image/sign", SyncResultSchema, {
      postId: post.id,
      garmentId: pieceId,
    })
      .then((r) => {
        if (active) {
          setError(false);
          setUri(r.signedUrl);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [post.id, post.updatedAt, pieceId, cloud, retry]);
  const height = pieceId
    ? compact
      ? 100
      : 235
    : compact
      ? 150
      : post.kind === "clothing"
        ? 330
        : 420;
  const dimensions =
    editorial && !pieceId && !square
      ? { aspectRatio: 4 / 5 }
      : square
        ? pieceId
          ? { flex: 1 }
          : { aspectRatio: 1 }
        : { height };
  if (pieceId && !image)
    return (
      <View style={dimensions}>
        <GarmentFallback
          compact
          garment={post.pieces.find((piece) => piece.id === pieceId)!}
        />
      </View>
    );
  if (error)
    return (
      <View
        style={{
          ...dimensions,
          backgroundColor: t.colors.sand,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: t.radius.md,
        }}
      >
        <Txt muted style={{ fontSize: 11 }}>
          Photo unavailable
        </Txt>
        <IconButton
          name="refresh-cw"
          label="Retry post photo"
          onPress={() => setRetry((v) => v + 1)}
        />
      </View>
    );
  if (cloud && !uri)
    return (
      <View style={{ height, justifyContent: "center" }}>
        <ActivityIndicator color={t.colors.sage} />
      </View>
    );
  if (cloud && uri)
    return (
      <View
        style={{
          ...dimensions,
          borderRadius: t.radius.lg,
          overflow: "hidden",
          backgroundColor: t.colors.sand,
        }}
      >
        <Image
          accessibilityLabel={
            pieceId
              ? post.pieces.find((p) => p.id === pieceId)?.name
              : "Outfit photo"
          }
          source={{ uri }}
          contentFit={square ? "cover" : "contain"}
          cachePolicy="memory-disk"
          style={{ width: "100%", height: "100%" }}
          onError={() => {
            if (!renewed.current) {
              renewed.current = true;
              setUri(undefined);
              setRetry((v) => v + 1);
            } else setError(true);
          }}
        />
      </View>
    );
  return (
    <GarmentImage
      uri={uri ?? undefined}
      label={
        pieceId
          ? post.pieces.find((p) => p.id === pieceId)?.name
          : "Outfit photo"
      }
      style={{
        ...dimensions,
        borderRadius: square ? t.radius.sm : t.radius.md,
        backgroundColor: t.colors.sand,
      }}
    />
  );
}
