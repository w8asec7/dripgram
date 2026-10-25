import React from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../../state/AppProvider";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Icon,
  Row,
  Txt,
} from "../../components/ui";
export function MessageInbox() {
  const { data, user } = useApp();
  if (!data || !user) return null;
  const chats = [
    ...data.groups
      .filter((g) => g.memberIds.includes(user.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: g.memberIds.length,
        route: `/social/group/${g.id}` as const,
      })),
    ...data.occasions
      .filter((o) => o.participantIds.includes(user.id))
      .map((o) => ({
        id: o.id,
        name: o.name,
        count: o.participantIds.length,
        route: `/occasion/${o.id}` as const,
      })),
  ];
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 14, paddingBottom: 32 }}
    >
      <Row between>
        <Button
          title="New conversation"
          icon="edit"
          onPress={() => router.push("/social/group/new")}
        />
        <Button
          title="Manage friends"
          variant="ghost"
          onPress={() => router.push("/settings/friends")}
        />
      </Row>
      {chats.map((chat) => (
        <Card key={chat.route} onPress={() => router.push(chat.route)}>
          <Row>
            <Avatar name={chat.name} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt style={{ fontWeight: "600" }}>{chat.name}</Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {chat.count} people · outfits & conversation
              </Txt>
            </View>
            <Icon name="chevron-right" size={18} />
          </Row>
        </Card>
      ))}
      {!chats.length && (
        <Empty
          title="Bring your people."
          body="Start a chat and share what inspires you."
          action="Create group chat"
          onPress={() => router.push("/social/group/new")}
        />
      )}
    </ScrollView>
  );
}
