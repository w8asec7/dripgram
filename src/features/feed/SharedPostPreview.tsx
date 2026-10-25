import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useApp } from "../../state/AppProvider";
import { FashionPost } from "../../models/posts";
import { postRepository } from "../../repositories/posts";
import { Card, Txt } from "../../components/ui";
import { PostVisual } from "./PostVisual";
export function SharedPostPreview({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { data, user } = useApp(),
    [post, setPost] = useState<FashionPost | null>(null),
    [unavailable, setUnavailable] = useState(false);
  const repo = useMemo(
    () => (data && user ? postRepository(user, data) : null),
    [data, user],
  );
  useEffect(() => {
    let active = true;
    if (repo)
      void repo
        .detail(id)
        .then((d) => {
          if (active) {
            setUnavailable(false);
            setPost(d.post);
          }
        })
        .catch(() => {
          if (active) {
            setPost(null);
            setUnavailable(true);
          }
        });
    return () => {
      active = false;
    };
  }, [id, repo]);
  return (
    <Card
      onPress={() => router.push(`/social/post/${id}`)}
      style={{ padding: 8 }}
    >
      {post && <PostVisual post={post} compact />}
      <Txt style={{ fontWeight: "600" }}>Shared outfit post</Txt>
      <Txt numberOfLines={2} muted>
        {unavailable ? "This post is private or no longer available." : title}
      </Txt>
    </Card>
  );
}
