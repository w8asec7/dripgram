import { useGrid } from "../../theme/responsive";
import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  FlatList,
  View,
  ActivityIndicator,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { FashionPost } from "../../models/posts";
import { postRepository, FeedCursor } from "../../repositories/posts";
import { useApp, friendlyError } from "../../state/AppProvider";
import { PostVisual } from "./PostVisual";
import { PostCard } from "./PostCard";
import { Button, Empty, Txt } from "../../components/ui";
import { theme as t } from "../../theme";
export function PostFeed({
  ownerId,
  savedOnly = false,
  header,
  grid = false,
}: {
  ownerId?: string;
  savedOnly?: boolean;
  header?: React.ReactElement;
  grid?: boolean;
}) {
  const { data, user } = useApp();
  const metrics = useGrid("profile");
  const { width } = useWindowDimensions();
  const editorial = Platform.OS === "web" && width >= 1100;
  const latest = useRef({ data, user });
  useEffect(() => {
    latest.current = { data, user };
  }, [data, user]);
  const [posts, setPosts] = useState<FashionPost[]>([]),
    [loading, setLoading] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [more, setMore] = useState(true),
    [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cursor = useRef<FeedCursor>({}),
    lock = useRef(false),
    generation = useRef(0);
  const load = useCallback(
    async (refresh = false) => {
      const { data, user } = latest.current;
      if (!data || !user || lock.current) return;
      lock.current = true;
      const version = generation.current;
      setLoading(true);
      setError("");
      if (refresh) setRefreshing(true);
      try {
        const page = await postRepository(user, data).page(
          refresh ? {} : cursor.current,
          ownerId,
          savedOnly,
        );
        if (version !== generation.current) return;
        cursor.current = page.cursor;
        if (refresh) setRefreshVersion((v) => v + 1);
        setPosts((old) => [
          ...new Map(
            [...(refresh ? [] : old), ...page.posts].map((p) => [p.id, p]),
          ).values(),
        ]);
        setMore(page.hasMore);
      } catch (e) {
        if (version === generation.current) setError(friendlyError(e));
      } finally {
        if (version === generation.current) {
          lock.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [ownerId, savedOnly],
  );
  useFocusEffect(
    useCallback(() => {
      generation.current++;
      lock.current = false;
      void load(true);
      return () => {
        generation.current++;
        lock.current = false;
      };
    }, [load]),
  );
  return (
    <FlatList
      key={grid ? `grid-${metrics.columns}` : "feed"}
      testID="fashion-feed"
      numColumns={grid ? metrics.columns : 1}
      columnWrapperStyle={grid ? { gap: metrics.gap } : undefined}
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) =>
        grid ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open post: ${item.caption || "Outfit photograph"}`}
            onPress={() => router.push(`/social/post/${item.id}`)}
            style={{
              width: metrics.cardWidth,
              aspectRatio: 1,
              overflow: "hidden",
              borderRadius: 8,
            }}
          >
            <PostVisual post={item} square />
          </Pressable>
        ) : (
          <PostCard
            post={item}
            refreshVersion={refreshVersion}
            editorial={editorial}
          />
        )
      }
      style={{ flex: 1 }}
      contentContainerStyle={{
        gap: grid ? metrics.gap : editorial ? 20 : 12,
        paddingBottom: grid ? 24 : 88,
      }}
      ListHeaderComponent={
        header ? (
          <View style={{ gap: 12, paddingBottom: 8 }}>{header}</View>
        ) : undefined
      }
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={5}
      onEndReached={() => {
        if (more && !loading) void load();
      }}
      onEndReachedThreshold={0.6}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      ListEmptyComponent={
        !loading && !error ? (
          <Empty
            title={
              savedOnly
                ? "Save a little inspiration."
                : "Your next inspiration starts here."
            }
            body={
              savedOnly
                ? "Bookmark posts to find them here."
                : "Share an outfit or clothing photo. Your closet stays private."
            }
            action="Create a post"
            onPress={() => router.push("/social/post/new")}
          />
        ) : undefined
      }
      ListFooterComponent={
        <View style={{ gap: 12 }}>
          {loading && <ActivityIndicator color={t.colors.sage} />}
          {!!error && (
            <>
              <Txt accessibilityRole="alert">{error}</Txt>
              <Button
                title="Retry feed"
                onPress={() => void load(posts.length === 0)}
              />
            </>
          )}
          {!loading && more && posts.length > 0 && (
            <Button
              title="More inspiration"
              variant="secondary"
              onPress={() => void load()}
            />
          )}
          {!loading && !more && posts.length > 0 && (
            <Txt muted style={{ textAlign: "center", fontSize: 12 }}>
              You’re caught up. Pull down to refresh.
            </Txt>
          )}
        </View>
      }
    />
  );
}
