import React from "react";
import { Switch, View } from "react-native";
import {
  Screen,
  Txt,
  Row,
  Card,
  Badge,
  Button,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { theme as t } from "../../theme";
export default function Notifications() {
  const { data, execute } = useApp();
  if (!data) return null;
  const prefs = data.profile.notifications;
  const updates = data.notifications.filter(
    (n) => n.kind !== "daily" && prefs[n.kind],
  );
  return (
    <Screen
      back
      title="Your updates."
      subtitle="Control the updates you see inside DripGram."
    >
      <Card>
        {(["occasions", "prices", "social"] as const).map((key) => (
          <Row key={key} between>
            <View style={{ flex: 1 }}>
              <Txt>
                {
                  {
                    occasions: "Upcoming plans",
                    prices: "Price watches",
                    social: "Friends & conversations",
                  }[key]
                }
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                In-app updates · no remote push service
              </Txt>
            </View>
            <Switch
              accessibilityLabel={`Enable ${key} notifications`}
              value={prefs[key]}
              onValueChange={(on) =>
                ignore(
                  execute({
                    type: "profile",
                    profile: {
                      ...data.profile,
                      notifications: { ...prefs, [key]: on },
                    },
                  }),
                )
              }
              trackColor={{ true: t.colors.sage, false: t.colors.border }}
            />
          </Row>
        ))}
      </Card>
      {updates.map((n) => (
        <Card key={n.id}>
          <Badge>{n.kind.toUpperCase()}</Badge>
          <Txt style={{ fontWeight: "600" }}>{n.title}</Txt>
          <Txt muted>{n.body}</Txt>
          {!n.read && (
            <Button
              title="Mark as read"
              variant="ghost"
              onPress={() =>
                ignore(execute({ type: "notification.read", id: n.id }))
              }
            />
          )}
        </Card>
      ))}
      {!updates.length && <Txt muted>No updates right now.</Txt>}
    </Screen>
  );
}
