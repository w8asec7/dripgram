import React, { useState, useRef } from "react";
import { router } from "expo-router";
import {
  Screen,
  Field,
  Txt,
  Chips,
  Button,
  ignore,
} from "../../../components/ui";
import { useApp } from "../../../state/AppProvider";
import { isFriend } from "../../../repositories/domain";
import { makeId, isoNow } from "../../../models";
export default function NewGroup() {
  const { data, user, execute, busy } = useApp();
  const [name, setName] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [error, setError] = useState("");
  const lock = useRef(false);
  const [id] = useState(() => makeId("group"));
  if (!data || !user) return null;
  const friends = data.directory.filter((p) => isFriend(data, user.id, p.id));
  return (
    <Screen
      back
      title="A circle for your style."
      subtitle="Reusable groups. Your closets stay private."
    >
      <Field
        label="Group name"
        placeholder="Weekend Crew"
        value={name}
        onChangeText={setName}
        error={error}
      />
      <Txt>Invite up to seven friends</Txt>
      <Chips
        options={friends.map((f) => f.displayName)}
        value=""
        onChange={(value) => {
          const p = friends.find((p) => p.displayName === value);
          if (p)
            setMembers(
              members.includes(p.id)
                ? members.filter((id) => id !== p.id)
                : members.length < 7
                  ? [...members, p.id]
                  : members,
            );
        }}
      />
      <Txt muted>
        {members
          .map((id) => friends.find((f) => f.id === id)?.displayName)
          .join(", ") || "No friends selected yet."}
      </Txt>
      {!friends.length && (
        <Button
          title="Find friends"
          variant="secondary"
          onPress={() => router.push("/settings/friends")}
        />
      )}
      <Button
        title="Create group"
        loading={busy}
        disabled={!members.length || name.trim().length < 2}
        onPress={() =>
          ignore(
            (async () => {
              if (lock.current) return;
              lock.current = true;
              setError("");
              try {
                await execute(
                  {
                    type: "group.save",
                    group: {
                      id,
                      ownerId: user.id,
                      name,
                      memberIds: [user.id, ...members],
                      createdAt: isoNow(),
                    },
                  },
                  "Your circle is ready.",
                );
                router.replace(`/social/group/${id}`);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not create your group.",
                );
              } finally {
                lock.current = false;
              }
            })(),
          )
        }
      />
    </Screen>
  );
}
