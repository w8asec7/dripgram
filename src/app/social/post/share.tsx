import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Txt, Button, Row, Avatar, Card } from "../../../components/ui";
import { useApp, friendlyError } from "../../../state/AppProvider";
import { postRepository } from "../../../repositories/posts";
import { chatRepository } from "../../../repositories/chat";
import { createChatMessage } from "../../../features/social/chatDomain";
import { isFriend } from "../../../repositories/domain";
import { isoNow } from "../../../models";
import { ChatMessage, ChatTarget } from "../../../models/chat";
export default function SharePost() {
  const { postId } = useLocalSearchParams<{ postId: string }>(),
    { data, user, execute } = useApp();
  const [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const message = useRef<ChatMessage | null>(null),
    lock = useRef(false);
  useEffect(() => {
    let active = true;
    if (data && user)
      void postRepository(user, data)
        .detail(postId)
        .then((d) => {
          if (active)
            setTitle(d.post.caption.slice(0, 140) || "An outfit worth sharing");
        })
        .catch((e) => {
          if (active) setError(friendlyError(e));
        });
    return () => {
      active = false;
    };
  }, [data, user, postId]);
  if (!data || !user) return null;
  const send = async (target: ChatTarget, friendId?: string) => {
    if (lock.current || !title) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let snapshot = data;
      if (friendId && !snapshot.groups.some((g) => g.id === target.id)) {
        const name =
          snapshot.directory.find((p) => p.id === friendId)?.displayName ||
          "Friend";
        snapshot = await execute({
          type: "group.save",
          group: {
            id: target.id,
            ownerId: user.id,
            name: `You & ${name}`.slice(0, 60),
            memberIds: [user.id, friendId],
            createdAt: isoNow(),
          },
        });
      }
      message.current ??= createChatMessage(user.id, "", null, null, {
        id: postId,
        title,
      });
      await chatRepository(user.mode === "demo", snapshot).send(
        target,
        message.current,
      );
      router.dismissTo(
        target.kind === "group"
          ? `/social/group/${target.id}`
          : `/occasion/${target.id}`,
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      back
      title="Send inspiration."
      subtitle="Recipients can open the original post only if its visibility allows them."
    >
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      {data.groups
        .filter((g) => g.memberIds.includes(user.id))
        .map((g) => (
          <Button
            key={g.id}
            title={g.name}
            icon="message-circle"
            disabled={!title || busy}
            loading={busy}
            onPress={() => void send({ kind: "group", id: g.id })}
          />
        ))}
      <Txt style={{ fontWeight: "600" }}>Friends</Txt>
      {data.directory
        .filter((p) => isFriend(data, user.id, p.id))
        .map((p) => (
          <Card key={p.id}>
            <Row>
              <Avatar name={p.displayName} />
              <Button
                title={`Send to ${p.displayName}`}
                disabled={!title || busy}
                variant="ghost"
                onPress={() =>
                  void send(
                    {
                      kind: "group",
                      id: `dm-${[user.id, p.id].sort().join("_")}`,
                    },
                    p.id,
                  )
                }
              />
            </Row>
          </Card>
        ))}
      <Button
        title="Create a new group"
        variant="secondary"
        onPress={() => router.push("/social/group/new")}
      />
    </Screen>
  );
}
