import React, { useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import {
  Screen,
  Txt,
  Card,
  Button,
  Badge,
  Row,
  GarmentImage,
} from "../../../components/ui";
import { useApp, friendlyError } from "../../../state/AppProvider";
import { postRepository } from "../../../repositories/posts";
import { fashionService } from "../../../services/fashion";
import type { FashionPost, StylePiece } from "../../../models/posts";
import { categoryGroup } from "../../../models";
import { theme as t } from "../../../theme";
import { compareLookToCloset } from "../../../features/shopping/lookComparison";
import { lookPieces } from "../../../features/shopping/lookAnalysis";
export default function FindSimilar() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const app = useApp(),
    latest = useRef(app);
  useEffect(() => {
    latest.current = app;
  }, [app]);
  const [post, setPost] = useState<FashionPost | null>(null),
    [pieces, setPieces] = useState<StylePiece[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const uid = app.user?.id,
    mode = app.services.mode;
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, user, services } = latest.current;
      if (!data || !user) return;
      setLoading(true);
      setError("");
      try {
        const { post } = await postRepository(user, data).detail(postId);
        const observations = await lookPieces(
          user.id,
          services.mode,
          post,
          () =>
            fashionService(user, data, services.mode === "live").analyze(post),
        );
        if (!active) return;
        setPost(post);
        setPieces(observations);
      } catch (e) {
        if (active) setError(friendlyError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [postId, uid, mode, retry]);
  const garments = app.data?.garments;
  const rows = useMemo(
    () => (garments && uid ? compareLookToCloset(pieces, garments, uid) : []),
    [pieces, garments, uid],
  );
  const owned = rows.filter((r) => r.status === "owned").length;
  return (
    <Screen
      back
      title={post?.kind === "clothing" ? "Find similar" : "Shop the look"}
      subtitle="Start with your closet. Shop the pieces you want."
    >
      {loading && (
        <Row>
          <ActivityIndicator color={t.colors.sage} />
          <Txt muted>Understanding the clothing…</Txt>
        </Row>
      )}
      {!!error && (
        <Card>
          <Txt accessibilityRole="alert">{error}</Txt>
          <Button
            title="Retry photo understanding"
            onPress={() => setRetry((v) => v + 1)}
          />
        </Card>
      )}
      {!!rows.length && (
        <Txt muted style={{ fontSize: 13 }}>
          {owned} of {rows.length} pieces have a similar match in your closet.
          Comparisons use category, color and visible pattern; exact fit may
          differ.
        </Txt>
      )}
      {rows.map((row) => (
        <Card
          key={row.index}
          style={{
            padding: 12,
            gap: 8,
            borderColor: row.recommended ? t.colors.sage : t.colors.border,
          }}
        >
          {row.recommended && <Badge>HIGHEST-PRIORITY ADDITION</Badge>}
          <Row style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            {row.match?.image && (
              <GarmentImage
                image={row.match.image}
                label={`Your closet: ${row.match.name}`}
                style={{ width: 48, height: 62 }}
              />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Txt style={{ fontWeight: "600", fontSize: 15 }}>
                {row.piece.name}
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {row.piece.primaryColor} · {row.piece.fit}
              </Txt>
              <Txt
                style={{
                  fontSize: 12,
                  color:
                    row.status === "owned" ? t.colors.success : t.colors.muted,
                }}
              >
                {row.reason}
              </Txt>
            </View>
          </Row>
          {row.match?.image && (
            <Txt muted style={{ fontSize: 10 }}>
              Thumbnail shows your closest owned piece.
            </Txt>
          )}
          <Row between>
            <Txt muted style={{ fontSize: 11 }}>
              {row.status === "owned"
                ? "Similar piece owned"
                : row.status === "missing"
                  ? "Missing category"
                  : row.status === "review"
                    ? "Review color"
                    : "Different color or pattern"}
            </Txt>
            <Button
              compact
              title={`Find similar ${row.piece.subcategory || row.piece.category}`}
              variant={row.recommended ? "primary" : "secondary"}
              onPress={() =>
                router.push({
                  pathname: "/social/post/shop-results",
                  params: {
                    query: row.query,
                    group: categoryGroup(row.piece.category) || "",
                    postId,
                    reason: row.piece.name,
                    pieceIndex: String(row.index),
                  },
                })
              }
            />
          </Row>
        </Card>
      ))}
      {!loading && !error && !rows.length && (
        <Txt muted>
          No distinct clothing pieces were identified. Try another post.
        </Txt>
      )}
    </Screen>
  );
}
