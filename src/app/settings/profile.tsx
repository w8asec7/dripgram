import { LookCard } from "../../features/social/LookCard";
import React from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Card,
  Row,
  Avatar,
  Badge,
  Empty,
  GarmentImage,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { isFriend, canReadLook } from "../../repositories/domain";
export default function FriendProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user } = useApp();
  const profile = data?.directory.find((p) => p.id === id);
  if (!data || !user || !profile)
    return (
      <Screen back>
        <Empty
          title="Profile not found"
          body="Try searching their username again."
        />
      </Screen>
    );
  return (
    <Screen back>
      <Card>
        <Row>
          <Avatar name={profile.displayName} size={72} />
          <Txt serif style={{ fontSize: 32, flex: 1 }}>
            {profile.displayName}
          </Txt>
        </Row>
        <Txt muted>@{profile.username}</Txt>
        <Badge>
          {isFriend(data, user.id, id) ? "IN YOUR CIRCLE" : "PUBLIC PROFILE"}
        </Badge>
      </Card>
      {data.sharedGarments
        .filter(
          (g) =>
            g.ownerId === id &&
            g.friendIds.includes(user.id) &&
            isFriend(data, user.id, id),
        )
        .map((g) => (
          <Card key={g.piece.id}>
            <Badge>SHARED WITH YOU</Badge>
            <GarmentImage image={g.piece.image} style={{ height: 240 }} />
            <Txt serif style={{ fontSize: 25 }}>
              {g.piece.name}
            </Txt>
            <Txt muted>
              {g.piece.primaryColor} · {g.piece.category}
            </Txt>
          </Card>
        ))}
      {data.looks
        .filter((l) => l.ownerId === id && canReadLook(data, user.id, l.id))
        .map((l) => (
          <LookCard key={l.id} look={l} />
        ))}
      <Empty
        icon="lock"
        title="A wardrobe is personal."
        body="Only intentionally shared pieces appear here. You can see shared outfit snapshots inside your occasions."
      />
    </Screen>
  );
}
