import { OutfitFeedbackButtons } from "../../features/outfits/OutfitFeedbackButtons";
import React from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Button,
  Row,
  Badge,
  Card,
  DemoNote,
  Empty,
  confirmAction,
  ignore,
} from "../../components/ui";
import { OutfitCollage } from "../../components/wardrobe";
import { useApp } from "../../state/AppProvider";
import { dateOffset } from "../../models";
export default function OutfitDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, execute, busy } = useApp();
  const outfit = data?.outfits.find((o) => o.id === id);
  if (!data || !outfit)
    return (
      <Screen back>
        <Empty
          title="This look isn’t here."
          body="It may have been removed. Create a new combination from your closet."
          action="Build a look"
          onPress={() => router.replace("/outfit/build")}
        />
      </Screen>
    );
  return (
    <Screen back>
      <OutfitCollage outfit={outfit} garments={data.garments} large />
      <Badge>{outfit.occasionType.toUpperCase()}</Badge>
      <Txt serif style={{ fontSize: 26, lineHeight: 31 }}>
        {outfit.name}
      </Txt>
      <Txt muted>{outfit.explanation}</Txt>
      <Row style={{ gap: 4 }}>
        <OutfitFeedbackButtons outfit={outfit} />
      </Row>
      {!!outfit.plannedFor && (
        <Card>
          <Txt style={{ fontWeight: "600" }}>
            Planned for {outfit.plannedFor}
          </Txt>
        </Card>
      )}
      <View style={{ gap: 10 }}>
        {outfit.items.map((item) => {
          const g = data.garments.find((g) => g.id === item.garmentId);
          return g ? (
            <Card key={g.id} onPress={() => router.push(`/garment/${g.id}`)}>
              <Row between>
                <Txt style={{ flex: 1 }}>{g.name}</Txt>
              </Row>
            </Card>
          ) : null;
        })}
      </View>
      <Button
        title="Plan for today"
        loading={busy}
        icon="calendar"
        onPress={() =>
          ignore(
            execute(
              { type: "outfit.plan", id: outfit.id, date: dateOffset(0) },
              "Planned for today.",
            ),
          )
        }
      />
      <Button
        title="Plan for tomorrow"
        variant="ghost"
        onPress={() =>
          ignore(
            execute(
              { type: "outfit.plan", id: outfit.id, date: dateOffset(1) },
              "Tomorrow’s look is ready.",
            ),
          )
        }
      />
      <Button
        title="Share this look"
        icon="send"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/social/post/new",
            params: { outfitId: outfit.id },
          })
        }
      />
      <DemoNote source={outfit.source || "deterministic-demo"} />
      <Button
        title="Delete saved look"
        variant="ghost"
        onPress={() =>
          confirmAction(
            "Delete this look?",
            "Garments and wear history stay in your wardrobe.",
            () =>
              ignore(
                execute(
                  { type: "outfit.delete", id: outfit.id },
                  "Look deleted.",
                ).then(() => router.replace("/outfit/saved")),
              ),
          )
        }
      />
    </Screen>
  );
}
