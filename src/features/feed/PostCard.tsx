import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { theme as t } from "../../theme";
import { FashionPost, PostDetail } from "../../models/posts";
import { PostVisual } from "./PostVisual";
import { useApp, friendlyError } from "../../state/AppProvider";
import { postRepository } from "../../repositories/posts";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Row,
  Txt,
} from "../../components/ui";
export function PostCard({
  post,
  detail = false,
  refreshVersion = 0,
  onComment,
  editorial = false,
}: {
  post: FashionPost;
  detail?: boolean;
  refreshVersion?: number;
  onComment?: () => void;
  editorial?: boolean;
}) {
  const { data, user } = useApp();
  const repo = useMemo(
    () => (data && user ? postRepository(user, data) : null),
    [data, user],
  );
  const [state, setState] = useState<PostDetail | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (repo)
      void repo
        .detail(post.id)
        .then((d) => {
          if (active) setState(d);
        })
        .catch((e) => {
          if (active) setError(friendlyError(e));
        });
    return () => {
      active = false;
    };
  }, [post.id, repo, refreshVersion]);
  if (!data || !user || !repo) return null;
  const creator =
      state?.creator || data.directory.find((p) => p.id === post.ownerId),
    liked = state?.likes.includes(user.id) || false;
  const openComments =
    onComment ||
    (() =>
      router.push({
        pathname: "/social/post/[id]",
        params: { id: post.id, comment: "1" },
      }));
  const toggle = async (kind: "like" | "save") => {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    const previous = state;
    const on = kind === "like" ? !liked : !state.saved;
    setState(
      kind === "like"
        ? {
            ...state,
            likes: on
              ? [...state.likes, user.id]
              : state.likes.filter((id) => id !== user.id),
          }
        : { ...state, saved: on },
    );
    try {
      if (kind === "like") await repo.like(post.id, on);
      else await repo.bookmark(post.id, on);
    } catch (e) {
      setState(previous);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
        gap: 6,
      }}
    >
      <Row between style={{ paddingVertical: 4, flexWrap: "nowrap" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            creator?.username ? `@${creator.username}` : "View creator"
          }
          onPress={() =>
            router.push({
              pathname: "/social/profile/[id]",
              params: { id: post.ownerId },
            })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 44,
            flex: 1,
          }}
        >
          <Avatar
            name={creator?.displayName || "Fashion creator"}
            photo={creator?.photo}
            userId={post.ownerId}
            size={34}
          />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
              @{creator?.username || "creator"}
            </Txt>
            <Txt muted style={{ fontSize: 11 }}>
              {post.sample ? "Sample creator" : creator?.displayName}
            </Txt>
          </View>
        </Pressable>
        {post.sample && <Badge>SAMPLE</Badge>}
      </Row>
      <PostVisual post={post} editorial={editorial} />
      {!post.image &&
        post.pieces.some((piece) => piece.image?.source === "bundled") && (
          <Txt muted style={{ fontSize: 10 }}>
            Representative garment photographs · Not a photo of the complete
            look
          </Txt>
        )}
      {post.sample && (
        <Txt muted style={{ fontSize: 10 }}>
          Licensed sample · Fictional account
        </Txt>
      )}
      <View style={{ gap: 5 }}>
        <Row between style={{ marginHorizontal: -6 }}>
          <Row>
            <IconButton
              name="heart"
              label={liked ? "Unlike post" : "Like post"}
              color={liked ? t.colors.error : undefined}
              disabled={!state || busy}
              onPress={() => void toggle("like")}
            />
            <IconButton
              name="message-circle"
              label="Comment on post"
              onPress={openComments}
            />
            <IconButton
              name="send"
              label="Share post in messages"
              onPress={() =>
                router.push({
                  pathname: "/social/post/share",
                  params: { postId: post.id },
                })
              }
            />
          </Row>
          <IconButton
            name="bookmark"
            label={state?.saved ? "Unsave post" : "Save post"}
            color={state?.saved ? t.colors.sage : undefined}
            disabled={!state || busy}
            onPress={() => void toggle("save")}
          />
        </Row>
        {!!state?.likes.length && (
          <Txt style={{ fontWeight: "600", fontSize: 12 }}>
            {state.likes.length}
            {state.likes.length === 200 ? "+" : ""} likes
          </Txt>
        )}
        {!!post.caption && (
          <Txt style={{ fontSize: 14 }}>
            <Txt style={{ fontSize: 14, fontWeight: "700" }}>
              {creator?.username || "creator"}{" "}
            </Txt>
            {post.caption}
          </Txt>
        )}
        <Txt muted style={{ fontSize: 11 }}>
          {post.visibility === "friends" ? "Friends only" : "Public"} ·{" "}
          {new Date(post.createdAt).toLocaleDateString()}
        </Txt>
        <Row style={{ gap: 8 }}>
          <Button
            compact
            variant="secondary"
            accessibilityLabel={
              post.kind === "clothing" ? "Find Similar" : "Remix With My Closet"
            }
            title={
              post.kind === "clothing"
                ? "Find Similar"
                : detail
                  ? "Remix With My Closet"
                  : "AI Remix"
            }
            icon={
              detail
                ? post.kind === "clothing"
                  ? "search"
                  : "shuffle"
                : undefined
            }
            onPress={() =>
              router.push({
                pathname:
                  post.kind === "clothing"
                    ? "/social/post/find-similar"
                    : "/social/post/remix",
                params: { postId: post.id },
              })
            }
          />
          {post.kind !== "clothing" && (
            <Button
              compact
              title={detail ? "Shop This Look" : "Shop look"}
              accessibilityLabel="Shop This Look"
              variant="secondary"
              icon={detail ? "shopping-bag" : undefined}
              onPress={() =>
                router.push({
                  pathname: "/social/post/find-similar",
                  params: { postId: post.id },
                })
              }
            />
          )}
        </Row>
        {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      </View>
    </View>
  );
}
