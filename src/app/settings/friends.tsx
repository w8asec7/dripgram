import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Card,
  Avatar,
  Field,
  Button,
  Section,
  Empty,
  Badge,
  confirmAction,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { isFriend } from "../../repositories/domain";
export default function Friends() {
  const { data, user, execute, busy } = useApp();
  const [search, setSearch] = useState("");
  if (!data || !user) return null;
  const friends = data.directory.filter((p) => isFriend(data, user.id, p.id));
  const incoming = data.requests.filter(
    (r) => r.toId === user.id && r.status === "pending",
  );
  const outgoing = data.requests.filter(
    (r) => r.fromId === user.id && r.status === "pending",
  );
  return (
    <Screen
      back
      title="Your kind of people."
      subtitle="Connections first. Wardrobe access is always optional."
    >
      <Field
        label="Search by username"
        value={search}
        onChangeText={setSearch}
        placeholder="e.g. samt"
        autoCapitalize="none"
      />
      {!!search.trim() &&
        data.directory
          .filter(
            (p) =>
              p.id !== user.id &&
              p.username.includes(search.toLowerCase().replace("@", "")),
          )
          .map((p) => (
            <Card key={p.id}>
              <Row>
                <Avatar name={p.displayName} />
                <View style={{ flex: 1 }}>
                  <Txt>{p.displayName}</Txt>
                  <Txt muted style={{ fontSize: 12 }}>
                    @{p.username}
                  </Txt>
                </View>
                {isFriend(data, user.id, p.id) ? (
                  <Badge>FRIENDS</Badge>
                ) : data.requests.some(
                    (r) =>
                      r.status === "pending" &&
                      [r.toId, r.fromId].includes(user.id) &&
                      [r.toId, r.fromId].includes(p.id),
                  ) ? (
                  <Badge>PENDING</Badge>
                ) : (
                  <Button
                    title="Add friend"
                    variant="secondary"
                    loading={busy}
                    onPress={() =>
                      ignore(
                        execute(
                          { type: "friend.request", toId: p.id },
                          "Friend request sent.",
                        ),
                      )
                    }
                  />
                )}
              </Row>
            </Card>
          ))}
      {!!search.trim() &&
        !data.directory.some(
          (p) =>
            p.id !== user.id &&
            p.username.includes(search.toLowerCase().replace("@", "")),
        ) && <Txt muted>No matching usernames. Try a shorter search.</Txt>}
      {!!incoming.length && (
        <>
          <Section title="A new connection" />
          {incoming.map((r) => {
            const p = data.directory.find((p) => p.id === r.fromId);
            return (
              <Card key={r.id}>
                <Row>
                  <Avatar name={p?.displayName || "Friend"} />
                  <View style={{ flex: 1 }}>
                    <Txt>{p?.displayName || "New friend"}</Txt>
                    <Txt muted style={{ fontSize: 12 }}>
                      @{p?.username}
                    </Txt>
                  </View>
                </Row>
                <Row>
                  <Button
                    title="Accept"
                    variant="secondary"
                    loading={busy}
                    onPress={() =>
                      ignore(
                        execute(
                          { type: "friend.respond", id: r.id, accept: true },
                          "A new friend in your circle.",
                        ),
                      )
                    }
                  />
                  <Button
                    title="Decline"
                    variant="ghost"
                    onPress={() =>
                      ignore(
                        execute(
                          { type: "friend.respond", id: r.id, accept: false },
                          "Request declined.",
                        ),
                      )
                    }
                  />
                </Row>
              </Card>
            );
          })}
        </>
      )}
      <Section title={`Your circle · ${friends.length}`} />
      {friends.map((p) => (
        <Card key={p.id}>
          <Row>
            <Avatar name={p.displayName} />
            <View style={{ flex: 1 }}>
              <Txt>{p.displayName}</Txt>
              <Txt muted style={{ fontSize: 12 }}>
                @{p.username}
              </Txt>
            </View>
            <Button
              title="Profile"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/settings/profile",
                  params: { id: p.id },
                })
              }
            />
          </Row>
          <Button
            title="Remove friend"
            variant="ghost"
            onPress={() =>
              confirmAction(
                "Remove this friend?",
                `Remove ${p.displayName} and revoke their access to your shared garments? Existing occasion snapshots remain visible to occasion participants.`,
                () =>
                  ignore(
                    execute(
                      { type: "friend.remove", friendId: p.id },
                      "Friend removed. Garment access revoked.",
                    ),
                  ),
              )
            }
          />
        </Card>
      ))}
      {!friends.length && (
        <Empty
          title="Room in your circle."
          body="Search for a username to send your first request."
        />
      )}
      {!!outgoing.length && (
        <>
          <Section title="Sent requests" />
          {outgoing.map((r) => (
            <Card key={r.id}>
              <Row between>
                <Txt>
                  {data.directory.find((p) => p.id === r.toId)?.displayName ||
                    "User"}
                </Txt>
                <Badge>PENDING</Badge>
              </Row>
            </Card>
          ))}
        </>
      )}
      {user.mode === "demo" && (
        <View>
          <Txt muted style={{ fontSize: 12 }}>
            Try @samt to send a request. Jordan’s incoming request can be
            accepted now. Demo friends are simulated; no messages are sent to
            real people.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
