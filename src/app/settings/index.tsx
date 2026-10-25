import { ClothingPreference } from "../../components/ClothingPreference";
import React from "react";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Card,
  Avatar,
  Badge,
  Button,
  Icon,
  confirmAction,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
export default function Settings() {
  const { data, user, signOut, resetDemo, refresh, execute } = useApp();
  if (!data || !user) return null;
  return (
    <Screen back title="A little more personal.">
      <Card>
        <Row>
          <Avatar name={data.profile.displayName} size={62} />
          <Txt serif style={{ fontSize: 28, flex: 1 }}>
            {data.profile.displayName}
          </Txt>
        </Row>
        <Txt muted>@{data.profile.username}</Txt>
        <Badge>
          {user.mode === "demo"
            ? "DEMO ACCOUNT · OFFLINE PERSISTENCE"
            : "FIREBASE ACCOUNT"}
        </Badge>
        <Button
          title="Edit profile & preferences"
          variant="secondary"
          onPress={() => router.push("/settings/edit-profile")}
        />
      </Card>
      <Card>
        <ClothingPreference
          value={data.profile.preferences.clothingMode}
          onChange={(clothingMode) =>
            ignore(
              execute(
                {
                  type: "profile",
                  profile: {
                    ...data.profile,
                    preferences: { ...data.profile.preferences, clothingMode },
                  },
                },
                "Clothing preference saved.",
              ),
            )
          }
        />
      </Card>
      {[
        { name: "City weather", icon: "cloud", route: "/settings/weather" },
        {
          name: "Your next seven days",
          icon: "calendar",
          route: "/occasion/week",
        },
        {
          name: "Connected services & usage",
          icon: "server",
          route: "/settings/services",
        },
        { name: "Your saved looks", icon: "layers", route: "/outfit/saved" },
        {
          name: "Friends & sharing",
          icon: "users",
          route: "/settings/friends",
        },
        {
          name: "Notifications & reminders",
          icon: "bell",
          route: "/settings/notifications",
        },
        {
          name: "Photography credits",
          icon: "image",
          route: "/settings/photo-credits",
        },
        { name: "Price watches", icon: "bookmark", route: "/product/watches" },
      ].map((item) => (
        <Card
          key={item.route}
          onPress={() => router.push(item.route as "/settings/history")}
        >
          <Row>
            <Icon name={item.icon as "layers"} />
            <Txt style={{ flex: 1 }}>{item.name}</Txt>
            <Icon name="chevron-right" size={17} />
          </Row>
        </Card>
      ))}
      <Card>
        <Txt style={{ fontWeight: "600" }}>
          Your wardrobe is private by default.
        </Txt>
        <Txt muted style={{ fontSize: 13 }}>
          Share a garment with selected friends in Edit piece. Share only an
          outfit snapshot inside an occasion. Being friends never opens your
          full wardrobe.
        </Txt>
      </Card>
      <Card>
        <Txt style={{ fontWeight: "600" }}>Calendar connection</Txt>
        <Txt muted style={{ fontSize: 13 }}>
          Not connected. Manual occasions work today. Calendar OAuth is not
          connected in this release.
        </Txt>
        <Button
          title="Create a manual occasion"
          variant="secondary"
          onPress={() => router.push("/occasion/new")}
        />
      </Card>
      <Button
        title={
          user?.mode === "firebase" ? "Refresh cloud data" : "Refresh my data"
        }
        variant="secondary"
        icon="refresh-cw"
        onPress={() => ignore(refresh())}
      />
      {user.mode === "demo" && (
        <Button
          title="Restore seeded demo"
          variant="ghost"
          onPress={() =>
            confirmAction(
              "Reset demo?",
              "This replaces your demo changes with the original sample wardrobe, friends, and occasions.",
              () => ignore(resetDemo().then(() => router.replace("/"))),
            )
          }
        />
      )}
      <Button
        title="Sign out"
        variant="ghost"
        onPress={() => ignore(signOut().then(() => router.replace("/")))}
      />
      <Txt muted style={{ fontSize: 11, textAlign: "center" }}>
        DripGram · HackTX 2026{`\n`}Your wardrobe. Your style. Your people.
      </Txt>
    </Screen>
  );
}
