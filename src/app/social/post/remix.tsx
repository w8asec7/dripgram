import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp, friendlyError } from "../../../state/AppProvider";
import {
  Screen,
  Txt,
  Card,
  Badge,
  Button,
  GarmentImage,
  Row,
} from "../../../components/ui";
import { postRepository } from "../../../repositories/posts";
import { FashionPost, RemixResult } from "../../../models/posts";
import { fashionService } from "../../../services/fashion";
import { remixOutfit } from "../../../features/feed/domain";
import { categoryGroup } from "../../../models";
import { PostVisual } from "../../../features/feed/PostVisual";
import { theme as t } from "../../../theme";
export default function RemixScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>(),
    app = useApp();
  const context = useRef(app);
  useEffect(() => {
    context.current = app;
  }, [app]);
  const [post, setPost] = useState<FashionPost | null>(null),
    [result, setResult] = useState<RemixResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const lock = useRef(false),
    variation = useRef(0),
    generation = useRef(0);
  const run = async (version: number) => {
    const { data, user, services } = context.current;
    if (!data || !user || lock.current) return;
    lock.current = true;
    setLoading(true);
    setError("");
    try {
      const detail = await postRepository(user, data).detail(postId);
      if (version !== generation.current) return;
      setPost(detail.post);
      const remixed = await fashionService(
        user,
        data,
        services.mode === "live",
      ).remix(detail.post, variation.current);
      if (version === generation.current) setResult(remixed);
    } catch (e) {
      if (version === generation.current) setError(friendlyError(e));
    } finally {
      lock.current = false;
      if (version === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    const version = ++generation.current;
    void run(version);
    return () => {
      generation.current = version + 1;
    }; /* Explicit Remix navigation is the only automatic inference entry. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, app.user?.id]);
  const { data, user, execute } = app;
  if (!data || !user) return null;
  const save = async (share = false) => {
    if (!result || saving) return;
    setSaving(true);
    setError("");
    try {
      const outfit = remixOutfit(result, data.garments, user.id);
      await execute({ type: "outfit.save", outfit });
      if (share)
        router.replace({
          pathname: "/social/post/new",
          params: { outfitId: outfit.id },
        });
      else router.dismissTo(`/social/post/${postId}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen
      back
      title="Make it yours."
      subtitle="Inspired by their look. Grounded in your closet."
    >
      {post && (
        <>
          <Badge>ORIGINAL OUTFIT</Badge>
          <PostVisual post={post} compact />
        </>
      )}
      {loading && (
        <Card>
          <ActivityIndicator color={t.colors.sage} />
          <Txt>Finding the closest pieces in your closet…</Txt>
          <Txt muted style={{ fontSize: 12 }}>
            Structured outfits reuse shared details. Photo analysis is cached.
          </Txt>
        </Card>
      )}
      {!!error && (
        <Card>
          <Txt accessibilityRole="alert">{error}</Txt>
          <Button
            title="Retry remix"
            disabled={loading}
            onPress={() => void run(generation.current)}
          />
        </Card>
      )}
      {result && (
        <>
          <Badge>
            {result.source === "meta"
              ? "META · YOUR CLOSET REMIX"
              : "RULE-BASED SAMPLE REMIX"}
          </Badge>
          <Txt muted>{result.summary}</Txt>
          {result.matches.map((match) => {
            const g = data.garments.find((g) => g.id === match.garmentId);
            if (!g) return null;
            return (
              <Card key={match.sourceIndex}>
                <Txt muted style={{ fontSize: 12 }}>
                  Inspired by: {result.original.pieces[match.sourceIndex].name}
                </Txt>
                <Row>
                  <GarmentImage
                    image={g.image}
                    label={g.name}
                    style={{ width: 90, height: 110 }}
                  />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Txt style={{ fontWeight: "600" }}>{g.name}</Txt>
                    <Txt muted style={{ fontSize: 12 }}>
                      {match.explanation}
                    </Txt>
                    <Button
                      title="View my piece"
                      variant="ghost"
                      onPress={() => router.push(`/garment/${g.id}`)}
                    />
                  </View>
                </Row>
              </Card>
            );
          })}
          {!!result.missing.length && (
            <>
              <Txt serif style={{ fontSize: 27 }}>
                Complete this look
              </Txt>
              {result.missing.map((missing) => (
                <Card key={missing.sourceIndex}>
                  <Txt style={{ fontWeight: "600" }}>
                    {result.original.pieces[missing.sourceIndex].name}
                  </Txt>
                  <Txt muted>{missing.reason}</Txt>
                  <Button
                    title="Shop missing piece"
                    icon="shopping-bag"
                    onPress={() =>
                      router.push({
                        pathname: "/social/post/shop-results",
                        params: {
                          query: missing.query,
                          group:
                            categoryGroup(
                              result.original.pieces[missing.sourceIndex]
                                .category,
                            ) || "All",
                          postId,
                        },
                      })
                    }
                  />
                </Card>
              ))}
            </>
          )}
          {!result.matches.length && (
            <Txt muted>
              You don’t own a close match yet. Shop a missing piece, or add more
              clothing to your closet.
            </Txt>
          )}
          <Row>
            <Button
              title="Save my remix"
              icon="bookmark"
              loading={saving}
              disabled={!result.matches.length}
              style={{ flex: 1 }}
              onPress={() => void save()}
            />
            <Button
              title="Share remix"
              icon="send"
              variant="secondary"
              loading={saving}
              disabled={!result.matches.length}
              onPress={() => void save(true)}
            />
          </Row>
          <Button
            title="Shop similar pieces"
            icon="shopping-bag"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/social/post/shop-results",
                params: {
                  query: result.original.pieces
                    .map(
                      (p) => `${p.primaryColor} ${p.subcategory || p.category}`,
                    )
                    .join(" ")
                    .slice(0, 240),
                  postId,
                },
              })
            }
          />
          <Button
            title="Try another remix"
            icon="shuffle"
            variant="ghost"
            disabled={loading}
            onPress={() => {
              variation.current++;
              void run(generation.current);
            }}
          />
          <Txt muted style={{ fontSize: 11 }}>
            {result.analysisSource === "structured"
              ? "Uses the creator’s explicitly shared garment details; no image-analysis call."
              : result.analysisSource === "image"
                ? "Visible clothing was analyzed by Meta and cached for this photo version."
                : "Sample inspiration and rule-based matching; no live AI used."}
          </Txt>
        </>
      )}
    </Screen>
  );
}
