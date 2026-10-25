import React from "react";
import { View, Platform, useWindowDimensions } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Icon } from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme as t } from "../../theme";
export const unstable_settings = { initialRouteName: "feed" };
export default function TabLayout() {
  const { user, data } = useApp();
  const { width } = useWindowDimensions();
  const sidebar = Platform.OS === "web" && width >= 1100;
  const desktop = Platform.OS === "web" && width >= 768;
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/" />;
  if (!data) return null;
  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.sage,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: {
          ...(sidebar ? { display: "none" as const } : {}),
          backgroundColor: t.colors.background,
          borderTopColor: t.colors.border,
          paddingTop: 6,
          paddingBottom: Math.max(8, insets.bottom),
          height: desktop ? 68 : 74 + insets.bottom,
          ...(desktop
            ? { maxWidth: 720, width: "100%", alignSelf: "center" as const }
            : {}),
        },
        tabBarIconStyle: { width: 56, height: 32 },
        tabBarLabelStyle: { fontSize: 12, marginTop: 4, fontWeight: "700" },
        sceneStyle: { backgroundColor: t.colors.background },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarAccessibilityLabel: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? t.colors.sageLight : "transparent",
                width: 54,
                height: 30,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: t.radius.pill,
              }}
            >
              <Icon
                name="home"
                color={typeof color === "string" ? color : t.colors.muted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: "Closet",
          tabBarAccessibilityLabel: "Closet",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? t.colors.sageLight : "transparent",
                width: 54,
                height: 30,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: t.radius.pill,
              }}
            >
              <Icon
                name="grid"
                color={typeof color === "string" ? color : t.colors.muted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarAccessibilityLabel: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? t.colors.sageLight : "transparent",
                width: 54,
                height: 30,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: t.radius.pill,
              }}
            >
              <Icon
                name="compass"
                color={typeof color === "string" ? color : t.colors.muted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                backgroundColor: focused ? t.colors.sageLight : "transparent",
                width: 54,
                height: 30,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: t.radius.pill,
              }}
            >
              <Icon
                name="user"
                color={typeof color === "string" ? color : t.colors.muted}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
  return tabs;
}
