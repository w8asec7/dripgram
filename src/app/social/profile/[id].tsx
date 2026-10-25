import React from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Screen, Avatar, Txt, Row, Button } from "../../../components/ui";
import { useApp } from "../../../state/AppProvider";
import { PostFeed } from "../../../features/feed/PostFeed";
export default function CreatorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { data, user } = useApp();
  if (!data) return null;
  const p = data.directory.find((p) => p.id === id);
  return (
    <Screen
      maxWidth={1040}
      scroll={false}
      back
      title={p?.displayName || "Fashion creator"}
    >
      <PostFeed
        grid
        ownerId={id}
        header={
          <>
            <Row>
              <Avatar
                name={p?.displayName || "Creator"}
                photo={p?.photo}
                userId={id}
                size={64}
              />
              <Txt>@{p?.username || "thread_member"}</Txt>
            </Row>
            {!!p?.bio && <Txt muted>{p.bio}</Txt>}
            {id === user?.id && (
              <Button
                title="Edit profile"
                variant="ghost"
                onPress={() => router.push("/settings/edit-profile")}
              />
            )}
            <Txt muted style={{ fontSize: 12 }}>
              Shared outfits only. Private closet information stays private.
            </Txt>
          </>
        }
      />
    </Screen>
  );
}
