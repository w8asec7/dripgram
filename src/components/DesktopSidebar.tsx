import React from "react";
import { Pressable, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Avatar, Icon, Txt } from "./ui";
import { useApp } from "../state/AppProvider";
import { theme as t } from "../theme";
export const desktopSidebarWidth = 244;
export function DesktopSidebar() {
  const path = usePathname(),
    { data, user } = useApp();
  const links = [
    {
      label: "Feed",
      icon: "home" as const,
      href: "/(tabs)/feed" as const,
      active: "/feed",
    },
    {
      label: "Closet",
      icon: "grid" as const,
      href: "/(tabs)/closet" as const,
      active: "/closet",
    },
    {
      label: "Discover",
      icon: "compass" as const,
      href: "/(tabs)/discover" as const,
      active: "/discover",
    },
    {
      label: "Messages",
      icon: "message-circle" as const,
      href: "/social/messages" as const,
      active: "/social/messages",
    },
    {
      label: "Create post",
      icon: "plus-square" as const,
      href: "/social/post/new" as const,
      active: "/social/post/new",
    },
    {
      label: "Profile",
      icon: "user" as const,
      href: "/(tabs)/profile" as const,
      active: "/profile",
    },
  ];
  return (
    <View
      testID="desktop-sidebar"
      style={{
        width: desktopSidebarWidth,
        borderRightWidth: 1,
        borderRightColor: t.colors.border,
        padding: 20,
        paddingTop: 32,
        gap: 28,
      }}
    >
      <Txt
        style={{
          fontSize: 27,
          fontWeight: "700",
          letterSpacing: -1,
          paddingHorizontal: 12,
        }}
      >
        DripGram
      </Txt>
      <View style={{ gap: 8 }}>
        {links.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: path === item.active }}
            onPress={() => router.navigate(item.href)}
            style={({ pressed }) => ({
              minHeight: 50,
              paddingHorizontal: 12,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              backgroundColor:
                pressed || path === item.active
                  ? t.colors.surface
                  : "transparent",
            })}
          >
            {item.label === "Profile" && data && user ? (
              <Avatar
                name={data.profile.displayName}
                photo={data.profile.photo}
                userId={user.id}
                size={24}
              />
            ) : (
              <Icon
                name={item.icon}
                size={23}
                color={path === item.active ? t.colors.sage : t.colors.ink}
              />
            )}
            <Txt
              style={{
                fontSize: 16,
                fontWeight: path === item.active ? "700" : "400",
              }}
            >
              {item.label}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push("/settings")}
        style={{
          minHeight: 48,
          flexDirection: "row",
          gap: 16,
          alignItems: "center",
          paddingHorizontal: 12,
        }}
      >
        <Icon name="settings" size={22} />
        <Txt>Settings</Txt>
      </Pressable>
    </View>
  );
}
