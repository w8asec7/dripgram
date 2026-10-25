import React, { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Chips,
  IconButton,
  Avatar,
  Txt,
  Row,
  Button,
} from "../../components/ui";
import { PostFeed } from "../../features/feed/PostFeed";
import { useApp } from "../../state/AppProvider";
export default function Profile() {
  const { data, user } = useApp();
  const [saved, setSaved] = useState(false);
  if (!data || !user) return null;
  return (
    <Screen
      maxWidth={1040}
      scroll={false}
      title="Your profile"
      action={
        <IconButton
          name="settings"
          label="Settings"
          onPress={() => router.push("/settings")}
        />
      }
    >
      <PostFeed
        grid
        ownerId={!saved ? user.id : undefined}
        savedOnly={saved}
        header={
          <>
            <Row>
              <Avatar
                name={data.profile.displayName}
                photo={data.profile.photo}
                userId={user.id}
                size={68}
              />
              <Txt style={{ fontSize: 20, fontWeight: "700", flex: 1 }}>
                {data.profile.displayName}
              </Txt>
            </Row>
            <Txt muted style={{ fontSize: 13, marginTop: -4 }}>
              @{data.profile.username}
            </Txt>
            <Row style={{ gap: 20 }}>
              <Txt style={{ fontSize: 13 }}>
                <Txt style={{ fontWeight: "700" }}>
                  {data.friendships.length}
                </Txt>{" "}
                friends
              </Txt>
              <Txt style={{ fontSize: 13 }}>
                <Txt style={{ fontWeight: "700" }}>{data.outfits.length}</Txt>{" "}
                saved outfits
              </Txt>
            </Row>
            {!!data.profile.bio && <Txt>{data.profile.bio}</Txt>}
            <Row>
              <Button
                compact
                title="Edit profile"
                variant="secondary"
                onPress={() => router.push("/settings/edit-profile")}
              />
              <Button
                compact
                title="Friends"
                variant="ghost"
                onPress={() => router.push("/settings/friends")}
              />
            </Row>
            <Row>
              <Button
                compact
                title="Saved outfits"
                variant="ghost"
                icon="bookmark"
                onPress={() => router.push("/outfit/saved")}
              />
              <Button
                compact
                title="Seven-day planner"
                variant="ghost"
                icon="calendar"
                onPress={() => router.push("/occasion/week")}
              />
            </Row>
            <Chips
              options={["My posts", "Saved posts"]}
              value={saved ? "Saved posts" : "My posts"}
              onChange={(v) => setSaved(v === "Saved posts")}
            />
          </>
        }
      />
    </Screen>
  );
}
