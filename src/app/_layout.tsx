import { ReminderBridge } from "../features/notifications/ReminderBridge";
import React from "react";
import { useFonts } from "expo-font";
import { Feather } from "@expo/vector-icons";
import {
  View,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../state/AppProvider";
import { Txt, Reveal } from "../components/ui";
import { theme } from "../theme";
import {
  DesktopSidebar,
  desktopSidebarWidth,
} from "../components/DesktopSidebar";
import { DesktopInsetContext } from "../theme/responsive";
function Routes() {
  const { loading, notice, user, data } = useApp();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const desktop =
    Platform.OS === "web" &&
    width >= 1100 &&
    !!user &&
    !!data?.profile.onboardingComplete &&
    pathname !== "/" &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/onboarding");
  const [iconsLoaded, fontError] = useFonts(Feather.font);
  if (loading || (!iconsLoaded && !fontError))
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Txt serif style={{ fontSize: 44 }}>
          DripGram
        </Txt>
        <ActivityIndicator color={theme.colors.sage} />
      </View>
    );
  return (
    <>
      <ReminderBridge />
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: theme.colors.background,
        }}
      >
        {desktop && <DesktopSidebar />}
        <View key="app-content" style={{ flex: 1, minWidth: 0 }}>
          <DesktopInsetContext.Provider
            value={desktop ? desktopSidebarWidth : 0}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
                animation: "slide_from_right",
              }}
            />
          </DesktopInsetContext.Provider>
        </View>
      </View>
      <Toast message={notice} />
    </>
  );
}
function Toast({ message }: { message: string | null }) {
  return message ? (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        bottom: 100,
        left: 24,
        right: 24,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        borderRadius: 16,
        maxWidth: 600,
        alignSelf: "center",
      }}
    >
      <Reveal>
        <Txt style={{ color: theme.colors.ink }}>{message}</Txt>
      </Reveal>
    </View>
  ) : null;
}
export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Routes />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
export { ErrorBoundary } from "expo-router";
