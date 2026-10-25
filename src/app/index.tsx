import React from "react";
import { View } from "react-native";
import { router, Redirect } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Button,
  GarmentImage,
  Badge,
  ignore,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { theme as t } from "../theme";
export default function Welcome() {
  const { user, data, enterDemo, busy } = useApp();
  if (user && data?.profile.onboardingComplete)
    return <Redirect href="/(tabs)/feed" />;
  return (
    <Screen>
      <Row between style={{ paddingTop: 28 }}>
        <Txt serif style={{ fontSize: 37 }}>
          DripGram
        </Txt>
        <Badge>YOUR EVERYDAY, ELEVATED</Badge>
      </Row>
      <Row>
        <Button
          title="Log in"
          icon="log-in"
          style={{ flex: 1 }}
          onPress={() => router.push("/auth/sign-in")}
        />
        <Button
          title="Explore demo"
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy}
          onPress={() =>
            ignore(
              enterDemo().then(() =>
                router.replace(
                  user?.mode === "demo" && data?.profile.onboardingComplete
                    ? "/(tabs)/feed"
                    : "/onboarding",
                ),
              ),
            )
          }
        />
      </Row>
      <View
        style={{
          height: 320,
          backgroundColor: t.colors.sageLight,
          borderRadius: t.radius.xl,
          overflow: "hidden",
          marginTop: 12,
        }}
      >
        <GarmentImage
          uri="look-street"
          label="Licensed sample street-style photograph"
          style={{ flex: 1 }}
        />
        <View style={{ position: "absolute", bottom: 18, left: 18 }}>
          <Badge>DISCOVER. REMIX. MAKE IT YOURS.</Badge>
        </View>
      </View>
      <View style={{ gap: 14, paddingVertical: 12 }}>
        <Txt serif style={{ fontSize: 44, lineHeight: 48 }}>
          Your wardrobe.{`\n`}Your style.{`\n`}Your people.
        </Txt>
        <Txt muted style={{ lineHeight: 24 }}>
          Discover a look. Make it yours.{`\n`}Recreate it with your closet, or
          shop the missing pieces.
        </Txt>
      </View>
      {user?.mode === "firebase" && data && (
        <Button
          title={`Continue as ${data.profile.displayName.split(" ")[0]}`}
          variant="secondary"
          onPress={() =>
            router.replace(
              data.profile.onboardingComplete ? "/(tabs)/feed" : "/onboarding",
            )
          }
        />
      )}
      <Button
        title="Get started"
        icon="arrow-right"
        onPress={() => router.push("/auth/sign-up")}
      />
      <Button
        title="Offline sample demo"
        variant="ghost"
        onPress={() =>
          ignore(enterDemo(true).then(() => router.replace("/onboarding")))
        }
      />
      <Row style={{ justifyContent: "center" }}>
        <Txt muted>Already part of the circle?</Txt>
        <Button
          title="Sign in"
          variant="ghost"
          onPress={() => router.push("/auth/sign-in")}
        />
      </Row>
      <Txt muted style={{ fontSize: 11, textAlign: "center" }}>
        Private by default. Personal by design.
      </Txt>
    </Screen>
  );
}
