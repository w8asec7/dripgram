import { ChatAttachmentPicker } from "./ChatAttachmentPicker";
import { ChatMessageBubble } from "./ChatMessageBubble";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Card,
  Button,
  IconButton,
  Empty,
  confirmAction,
  ignore,
} from "../../components/ui";
import { useApp, friendlyError } from "../../state/AppProvider";
import { ChatAttachment, ChatMessage, ChatTarget } from "../../models/chat";
import { chatRepository } from "../../repositories/chat";
import { createChatMessage } from "./chatDomain";
import { theme as t } from "../../theme";
export function ChatScreen({ target }: { target: ChatTarget }) {
  const { data, user, execute, busy } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [menu, setMenu] = useState(false),
    [info, setInfo] = useState(false);
  const [picker, setPicker] = useState<"closet" | "saved" | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null),
    [replyTo, setReplyTo] = useState<ChatMessage["replyTo"]>(null);
  const [retry, setRetry] = useState(0),
    [hasOlder, setHasOlder] = useState(false),
    [loadingOlder, setLoadingOlder] = useState(false);
  const lock = useRef(false),
    draft = useRef<ChatMessage | null>(null);
  const repo = useMemo(
    () => (data && user ? chatRepository(user.mode === "demo", data) : null),
    [data, user],
  );
  const group = data?.groups.find(
    (g) => target.kind === "group" && g.id === target.id,
  );
  const occasion = data?.occasions.find(
    (o) => target.kind === "occasion" && o.id === target.id,
  );
  const memberIds = group?.memberIds || occasion?.participantIds || [];
  const authorized = !!user && memberIds.includes(user.id);
  const targetKey = `${target.kind}:${target.id}`;
  useEffect(() => {
    if (!repo || !authorized) return;
    return repo.subscribe(
      target,
      (latest) => {
        setMessages((previous) => {
          const map = new Map(previous.map((m) => [m.id, m]));
          latest.forEach((m) => map.set(m.id, m));
          return [...map.values()].sort(
            (a, b) =>
              a.createdAt.localeCompare(b.createdAt) ||
              a.id.localeCompare(b.id),
          );
        });
        setHasOlder((previous) => previous || latest.length === 50);
        setLoading(false);
      },
      (e) => {
        setLoading(false);
        setMessages([]);
        setError(friendlyError(e));
      },
    );
    // Stable repository/target; snapshot updates do not create another listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, targetKey, authorized, retry]);
  if (!data || !user || !repo || !authorized)
    return (
      <Screen back>
        <Empty
          title="This conversation is private."
          body="Ask a member to invite you, then refresh your account."
        />
      </Screen>
    );
  const title = group?.name || occasion?.name || "Conversation";
  const nameFor = (id: string) =>
    id === user.id
      ? data.profile.displayName
      : data.directory.find((p) => p.id === id)?.displayName || "Member";
  const send = async () => {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setError("");
    try {
      const pending = draft.current;
      const message =
        pending &&
        pending.text === text.trim() &&
        JSON.stringify(pending.attachment) === JSON.stringify(attachment) &&
        JSON.stringify(pending.replyTo) === JSON.stringify(replyTo)
          ? pending
          : createChatMessage(user.id, text, attachment, replyTo);
      draft.current = message;
      await repo.send(target, message);
      setText("");
      setAttachment(null);
      setReplyTo(null);
      draft.current = null;
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setSending(false);
    }
  };
  const older = async () => {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const page = await repo.older(target, messages[0].id);
      setMessages((current) =>
        [...new Map([...page, ...current].map((m) => [m.id, m])).values()].sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        ),
      );
      setHasOlder(page.length === 50);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoadingOlder(false);
    }
  };
  return (
    <Screen scroll={false}>
      <Row between style={{ paddingTop: 8, gap: 6 }}>
        <IconButton
          name="arrow-left"
          label="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/feed")
          }
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt serif numberOfLines={2} style={{ fontSize: 24 }}>
            {title}
          </Txt>
          <Txt muted numberOfLines={2} style={{ fontSize: 11 }}>
            {memberIds.length} members ·{" "}
            {user.mode === "demo" ? "Demo chat · local" : "Private group chat"}
          </Txt>
        </View>
        <IconButton
          name="info"
          label="Conversation details"
          onPress={() => {
            Keyboard.dismiss();
            setInfo(!info);
          }}
        />
      </Row>
      {info && (
        <Card>
          <Txt style={{ fontWeight: "600" }}>{title}</Txt>
          <Txt>{memberIds.map(nameFor).join(" · ")}</Txt>
          {occasion && (
            <Txt muted>
              {occasion.date} · {occasion.time}
              {occasion.dressCode ? ` · ${occasion.dressCode}` : ""}
            </Txt>
          )}
          <Txt muted style={{ fontSize: 12 }}>
            Only messages and the pieces explicitly attached here are shared.
            Sharing never records a wear.
          </Txt>
          {occasion?.participants.find((p) => p.userId === user.id)?.status ===
            "invited" && (
            <Button
              title="Join conversation"
              loading={busy}
              onPress={() =>
                ignore(
                  execute(
                    { type: "occasion.join", id: target.id },
                    "Invitation accepted.",
                  ),
                )
              }
            />
          )}
          {occasion?.ownerId === user.id && (
            <Button
              title="Edit event details"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/occasion/edit",
                  params: { id: target.id },
                })
              }
            />
          )}
          {group && (
            <Button
              title={group.ownerId === user.id ? "Delete group" : "Leave group"}
              variant="ghost"
              onPress={() =>
                confirmAction(
                  group.ownerId === user.id ? "Delete group?" : "Leave group?",
                  "Conversation access ends. Your clothes and wear history remain saved.",
                  () =>
                    ignore(
                      execute({ type: "group.leave", id: group.id }).then(() =>
                        router.dismissTo("/(tabs)/feed"),
                      ),
                    ),
                )
              }
            />
          )}
          {occasion?.ownerId === user.id && (
            <Button
              title="Delete occasion"
              variant="ghost"
              onPress={() =>
                confirmAction(
                  "Delete this occasion?",
                  "Conversation access ends for participants.",
                  () =>
                    ignore(
                      execute({ type: "occasion.delete", id: target.id }).then(
                        () => router.dismissTo("/(tabs)/feed"),
                      ),
                    ),
                )
              }
            />
          )}
          {occasion && (
            <Button
              title="Styling & previous shared looks"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/occasion/styling",
                  params: { id: target.id },
                })
              }
            />
          )}
        </Card>
      )}
      {loading ? (
        <ActivityIndicator
          color={t.colors.sage}
          accessibilityLabel="Loading messages"
        />
      ) : (
        <FlatList
          testID="chat-messages"
          style={{ flex: 1, minHeight: 80 }}
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: 14, paddingVertical: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          initialNumToRender={12}
          windowSize={5}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 80,
          }}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], padding: 20 }}>
              <Txt serif style={{ fontSize: 26 }}>
                Start the conversation.
              </Txt>
              <Txt muted>Say hello, or share a look with the + button.</Txt>
            </View>
          }
          ListFooterComponent={
            hasOlder ? (
              <Button
                title="Earlier messages"
                variant="ghost"
                loading={loadingOlder}
                onPress={() => void older()}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <ChatMessageBubble
              item={item}
              mine={item.authorId === user.id}
              name={nameFor(item.authorId)}
              target={target}
              onReply={setReplyTo}
            />
          )}
        />
      )}
      {!!error && (
        <View style={{ gap: 6 }}>
          <Txt
            accessibilityRole="alert"
            style={{ color: t.colors.error, fontSize: 13 }}
          >
            {error}
          </Txt>
          <Button
            title="Retry conversation"
            variant="ghost"
            onPress={() => {
              setLoading(true);
              setError("");
              setRetry((n) => n + 1);
            }}
          />
        </View>
      )}
      <View style={{ gap: 8 }}>
        {menu && (
          <Card>
            <Button
              title="Create AI Outfit"
              icon="layers"
              variant="ghost"
              onPress={() => {
                setMenu(false);
                router.push({
                  pathname: "/outfit/build",
                  params: {
                    chatKind: target.kind,
                    chatId: target.id,
                    occasion: occasion?.type,
                  },
                });
              }}
            />
            <Button
              title="Select From My Closet"
              icon="grid"
              variant="ghost"
              onPress={() => {
                setMenu(false);
                setPicker("closet");
              }}
            />
            <Button
              title="Share Saved Outfit"
              icon="bookmark"
              variant="ghost"
              onPress={() => {
                setMenu(false);
                setPicker("saved");
              }}
            />
          </Card>
        )}
        {(attachment || replyTo) && (
          <Card style={{ padding: 10 }}>
            <Row between>
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={2} style={{ fontSize: 12 }}>
                  {attachment
                    ? `Outfit: ${attachment.title} · ${attachment.pieces.length} pieces`
                    : `Reply: ${replyTo?.preview}`}
                </Txt>
                {attachment && (
                  <Txt muted style={{ fontSize: 11 }}>
                    Share only · wear history stays unchanged
                  </Txt>
                )}
              </View>
              <IconButton
                name="x"
                label="Remove attachment or reply"
                onPress={() => {
                  setAttachment(null);
                  setReplyTo(null);
                }}
              />
            </Row>
          </Card>
        )}
        <Row style={{ alignItems: "flex-end", gap: 6 }}>
          <IconButton
            name={menu ? "x" : "plus"}
            label={menu ? "Close attachment menu" : "Add outfit attachment"}
            onPress={() => {
              Keyboard.dismiss();
              setMenu(!menu);
            }}
          />
          <TextInput
            keyboardAppearance="dark"
            accessibilityLabel="Message"
            testID="chat-message-input"
            onFocus={() => {
              setMenu(false);
              setInfo(false);
            }}
            placeholder="Message your people…"
            placeholderTextColor={t.colors.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            editable={!sending}
            style={{
              flex: 1,
              minHeight: 46,
              maxHeight: 100,
              padding: 12,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: t.colors.border,
              color: t.colors.ink,
              backgroundColor: t.colors.surface,
              fontSize: 16,
            }}
          />
          {sending ? (
            <ActivityIndicator
              accessibilityLabel="Sending message"
              style={{ width: 44, height: 44 }}
              color={t.colors.sage}
            />
          ) : (
            <IconButton
              name="arrow-up"
              label="Send message"
              disabled={!text.trim() && !attachment}
              onPress={() => void send()}
            />
          )}
        </Row>
      </View>
      {picker && (
        <ChatAttachmentPicker
          mode={picker}
          data={data}
          userId={user.id}
          onClose={() => setPicker(null)}
          onAttach={setAttachment}
          onError={(e) => setError(friendlyError(e))}
        />
      )}
    </Screen>
  );
}
