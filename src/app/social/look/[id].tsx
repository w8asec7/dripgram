import React, { useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Card,
  Button,
  Field,
  Empty,
  Row,
  Avatar,
  confirmAction,
  ignore,
} from "../../../components/ui";
import { useApp } from "../../../state/AppProvider";
import { canReadLook } from "../../../repositories/domain";
import { LookCard } from "../../../features/social/LookCard";
export default function Discussion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, execute, busy } = useApp();
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false);
  const look = data?.looks.find((l) => l.id === id);
  if (!data || !user || !look || !canReadLook(data, user.id, id))
    return (
      <Screen back>
        <Empty
          title="This look is private."
          body="It may have been removed, or your access changed."
        />
      </Screen>
    );
  const replies = data.looks.filter(
    (l) => l.parentId === id && canReadLook(data, user.id, l.id),
  );
  return (
    <Screen back title="A second opinion.">
      <LookCard look={look} compact />
      {look.comments.map((c) => (
        <Card key={c.id}>
          <Row>
            <Avatar
              size={30}
              name={
                data.directory.find((p) => p.id === c.authorId)?.displayName ||
                "Friend"
              }
            />
            <Txt style={{ flex: 1, fontWeight: "600" }}>
              {data.directory.find((p) => p.id === c.authorId)?.displayName ||
                "Friend"}
            </Txt>
          </Row>
          <Txt>{c.text}</Txt>
        </Card>
      ))}
      <Field
        label="Your opinion"
        value={text}
        onChangeText={setText}
        maxLength={180}
        placeholder="I’d try the black pants with this."
        multiline
        error={error}
      />
      <Button
        title="Post comment"
        icon="message-circle"
        disabled={!text.trim()}
        loading={busy}
        onPress={() =>
          ignore(
            (async () => {
              if (lock.current) return;
              lock.current = true;
              setError("");
              try {
                await execute({ type: "look.comment", id, text });
                setText("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not post comment.",
                );
              } finally {
                lock.current = false;
              }
            })(),
          )
        }
      />
      <Button
        title="Suggest a look from my closet"
        icon="layers"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/social/share",
            params: { parentId: id, groupId: look.groupId || "" },
          })
        }
      />
      {replies.map((l) => (
        <React.Fragment key={l.id}>
          <LookCard look={l} />
          <Button
            title="Compare these looks"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/social/compare",
                params: { ids: [look.id, l.id].join(",") },
              })
            }
          />
        </React.Fragment>
      ))}
      {look.ownerId === user.id && (
        <Button
          title="Remove shared look"
          variant="ghost"
          loading={busy}
          onPress={() =>
            confirmAction(
              "Remove this shared look?",
              "Your original outfit and garments stay in your closet.",
              () =>
                ignore(
                  execute(
                    { type: "look.delete", id },
                    "Shared look removed.",
                  ).then(() => router.dismissTo("/(tabs)/feed")),
                ),
            )
          }
        />
      )}
    </Screen>
  );
}
