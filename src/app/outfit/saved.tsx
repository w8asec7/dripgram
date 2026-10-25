import React from "react";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Card,
  Badge,
  Button,
  Empty,
} from "../../components/ui";
import { OutfitCollage } from "../../components/wardrobe";
import { useApp } from "../../state/AppProvider";
export default function SavedOutfits() {
  const { data } = useApp();
  if (!data) return null;
  return (
    <Screen
      back
      title="Your looks, collected."
      subtitle="Good combinations deserve another day."
    >
      <Button
        title="Build a new look"
        icon="plus"
        onPress={() => router.push("/outfit/build")}
      />
      {data.outfits.map((o) => (
        <Card
          key={o.id}
          onPress={() => router.push(`/outfit/${o.id}`)}
          style={{ padding: 0, overflow: "hidden" }}
        >
          <OutfitCollage outfit={o} garments={data.garments} />
          <Row between style={{ padding: 16 }}>
            <Txt serif style={{ fontSize: 25, flex: 1 }}>
              {o.name}
            </Txt>
            <Badge>{o.occasionType}</Badge>
          </Row>
        </Card>
      ))}
      {!data.outfits.length && (
        <Empty
          title="Your first favorite combination."
          body="Build a look from your available pieces, then save it here."
          action="Build a look"
          onPress={() => router.push("/outfit/build")}
        />
      )}
    </Screen>
  );
}
