import React from "react";
import { View, Pressable, Platform, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  IconButton,
  Icon,
  Badge,
  Avatar,
} from "../../components/ui";
import { PostFeed } from "../../features/feed/PostFeed";
import { useApp } from "../../state/AppProvider";
import { theme as t } from "../../theme";
export default function Feed() {
  const { user, data } = useApp(),
    { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1100,
    rightPanel = desktop && width >= 1280;
  const friends =
    data?.directory
      .filter((profile) =>
        data.friendships.some(
          (f) => f.members.includes(profile.id) && profile.id !== user?.id,
        ),
      )
      .slice(0, 4) || [];
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        backgroundColor: t.colors.background,
        paddingRight: desktop ? 244 : 0,
      }}
    >
      <View
        testID="feed-column"
        style={{ flex: 1, maxWidth: desktop ? 518 : 640, minWidth: 0 }}
      >
        <Screen scroll={false} maxWidth={desktop ? 518 : 640}>
          <Row
            between
            style={
              desktop
                ? {
                    minHeight: 44,
                    borderBottomWidth: 1,
                    borderBottomColor: t.colors.border,
                  }
                : undefined
            }
          >
            <Txt
              style={{
                fontSize: desktop ? 16 : 27,
                fontWeight: "700",
                letterSpacing: desktop ? 0 : -1,
              }}
            >
              {desktop ? "For you" : "DripGram"}
            </Txt>
            {!desktop && (
              <Row>
                <IconButton
                  name="plus-square"
                  label="Create post"
                  onPress={() => router.push("/social/post/new")}
                />
                <IconButton
                  name="message-circle"
                  label="Messages"
                  onPress={() => router.push("/social/messages")}
                />
              </Row>
            )}
          </Row>
          <PostFeed
            header={
              user?.mode === "demo" ? (
                <Badge>SAMPLE COMMUNITY · LICENSED PHOTOGRAPHY</Badge>
              ) : undefined
            }
          />
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", bottom: 18, right: 20 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Style Me"
              onPress={() => router.push("/outfit/style")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: t.colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: t.radius.pill,
                opacity: pressed ? 0.8 : 1,
                borderWidth: 1,
                borderColor: t.colors.sage,
                ...t.shadow,
              })}
            >
              <Icon name="zap" color={t.colors.onAccent} size={17} />
              <Txt
                style={{
                  color: t.colors.onAccent,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Style Me
              </Txt>
            </Pressable>
          </View>
        </Screen>
      </View>
      {rightPanel && data && user && (
        <View
          style={{
            position: "absolute",
            left: width / 2 + 47,
            top: 34,
            width: 264,
            gap: 24,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open my profile"
            onPress={() => router.navigate("/(tabs)/profile")}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Avatar
              name={data.profile.displayName}
              photo={data.profile.photo}
              userId={user.id}
              size={46}
            />
            <View>
              <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                @{data.profile.username}
              </Txt>
              <Txt muted style={{ fontSize: 13 }}>
                {data.profile.displayName}
              </Txt>
            </View>
          </Pressable>
          <View style={{ gap: 12 }}>
            <Row between>
              <Txt muted style={{ fontSize: 13, fontWeight: "600" }}>
                Your circle
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage friends"
                onPress={() => router.push("/settings/friends")}
              >
                <Txt style={{ fontSize: 12, color: t.colors.sage }}>Manage</Txt>
              </Pressable>
            </Row>
            {friends.map((friend) => (
              <Pressable
                key={friend.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${friend.displayName}`}
                onPress={() => router.push(`/social/profile/${friend.id}`)}
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                  minHeight: 44,
                }}
              >
                <Avatar
                  name={friend.displayName}
                  photo={friend.photo}
                  userId={friend.id}
                  size={34}
                />
                <View>
                  <Txt style={{ fontSize: 13, fontWeight: "600" }}>
                    @{friend.username}
                  </Txt>
                  <Txt muted style={{ fontSize: 12 }}>
                    {friend.displayName}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Photography credits"
              onPress={() => router.push("/settings/photo-credits")}
            >
              <Txt muted style={{ fontSize: 11 }}>
                Photography credits
              </Txt>
            </Pressable>
            <Txt muted style={{ fontSize: 11 }}>
              DripGram · HackTX 2026
            </Txt>
          </View>
        </View>
      )}
    </View>
  );
}
