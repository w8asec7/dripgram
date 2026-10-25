import React, { useCallback, useRef, useState, useEffect } from "react";
import { TextInput } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useApp, friendlyError } from "../../../state/AppProvider";
import {
  Screen,
  Txt,
  Card,
  Button,
  Field,
  Row,
  Chips,
  Empty,
  confirmAction,
} from "../../../components/ui";
import { PostCard } from "../../../features/feed/PostCard";
import { postRepository } from "../../../repositories/posts";
import { PostDetail } from "../../../models/posts";
import { makeId } from "../../../models";
import { apiRequest } from "../../../services/api";
import { removeDraftThumbnail } from "../../../services/images";
import { z } from "zod";
export default function PostDetails() {
  const { id, comment } = useLocalSearchParams<{
      id: string;
      comment?: string;
    }>(),
    { data, user } = useApp();
  const [detail, setDetail] = useState<PostDetail | null>(null),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false),
    [caption, setCaption] = useState(""),
    [visibility, setVisibility] = useState<"public" | "friends">("friends");
  const commentInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const commentFocused = useRef(false);
  useEffect(() => {
    if (detail && comment === "1" && !commentFocused.current) {
      commentFocused.current = true;
      requestAnimationFrame(() => commentInput.current?.focus());
    }
  }, [detail, comment]);
  const lock = useRef(false),
    commentId = useRef(makeId("comment"));
  const load = useCallback(async () => {
    if (!data || !user) return;
    setError("");
    try {
      setDetail(await postRepository(user, data).detail(id));
    } catch (e) {
      setError(friendlyError(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [data, user, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!data || !user) return null;
  const send = async () => {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    try {
      await postRepository(user, data).comment(id, text, commentId.current);
      setText("");
      commentId.current = makeId("comment");
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      if (detail?.post.image?.path)
        await apiRequest(
          "/v1/posts/image",
          z.object({ deleted: z.boolean() }),
          { postId: id, version: detail.post.image.version },
          "DELETE",
        );
      await postRepository(user, data).remove(id);
      if (user.mode === "demo" && detail?.post.image?.uri)
        await removeDraftThumbnail(detail.post.image.uri).catch(
          () => undefined,
        );
      router.dismissTo("/(tabs)/feed");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      back
      title={detail?.post.kind === "clothing" ? "The piece." : "The look."}
    >
      {detail ? (
        <>
          <PostCard
            post={detail.post}
            detail
            onComment={() => commentInput.current?.focus()}
            refreshVersion={detail.comments.length}
          />
          <Txt serif style={{ fontSize: 18 }}>
            Comments
          </Txt>
          {detail.comments.map((c) => (
            <Card key={c.id} style={{ padding: 10, borderWidth: 0, gap: 4 }}>
              <Row between>
                <Txt style={{ fontWeight: "600" }}>
                  {c.authorId === user.id
                    ? "You"
                    : data.directory.find((p) => p.id === c.authorId)
                        ?.displayName || "Member"}
                </Txt>
                <Txt muted style={{ fontSize: 10 }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </Txt>
              </Row>
              <Txt>{c.text}</Txt>
            </Card>
          ))}
          {!detail.comments.length && (
            <Txt muted>Be the first to share a thought.</Txt>
          )}
          <Field
            inputRef={commentInput}
            label="Add a comment"
            value={text}
            onChangeText={setText}
            maxLength={500}
            multiline
          />
          <Button
            title="Post comment"
            loading={busy}
            disabled={!text.trim()}
            onPress={() => void send()}
          />
          {detail.post.ownerId === user.id && (
            <>
              <Button
                title={editing ? "Cancel post edit" : "Edit my post"}
                icon="edit-2"
                variant="secondary"
                onPress={() => {
                  setCaption(detail.post.caption);
                  setVisibility(detail.post.visibility);
                  setEditing(!editing);
                }}
              />
              {editing && (
                <Card>
                  <Field
                    label="Edit caption"
                    testID="post-edit-caption-input"
                    value={caption}
                    onChangeText={setCaption}
                    maxLength={1000}
                    multiline
                  />
                  <Chips
                    options={["Friends only", "Public"]}
                    value={visibility === "public" ? "Public" : "Friends only"}
                    onChange={(value) =>
                      setVisibility(value === "Public" ? "public" : "friends")
                    }
                  />
                  <Button
                    title="Save post changes"
                    loading={busy}
                    onPress={() => {
                      if (busy) return;
                      setBusy(true);
                      void postRepository(user, data)
                        .edit(id, { caption, visibility })
                        .then(async () => {
                          setEditing(false);
                          await load();
                        })
                        .catch((e) => setError(friendlyError(e)))
                        .finally(() => setBusy(false));
                    }}
                  />
                </Card>
              )}
            </>
          )}
          {detail.post.ownerId === user.id && (
            <Button
              title="Delete my post"
              variant="ghost"
              disabled={busy}
              onPress={() =>
                confirmAction(
                  "Delete this post?",
                  "The post will be removed. Your clothes, photos in your camera roll and saved outfits remain.",
                  () => void remove(),
                )
              }
            />
          )}
        </>
      ) : loading ? (
        <Txt muted>Loading this look…</Txt>
      ) : (
        <Empty
          title="This look is unavailable."
          body="It may be private, removed, or temporarily offline."
          action="Retry post"
          onPress={() => void load()}
        />
      )}
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
    </Screen>
  );
}
