import React from "react";
import { router } from "expo-router";
import { Screen, Txt, Card, Button, Row } from "../../components/ui";
export default function AddClothing() {
  return (
    <Screen
      back
      title="Add your clothing."
      subtitle="Start with a few favorites. Photos are always optional."
    >
      <Card>
        <Txt serif style={{ fontSize: 27 }}>
          Photo
        </Txt>
        <Txt muted>Meta identifies one garment. Review every detail.</Txt>
        <Row>
          <Button
            title="Take photo"
            icon="camera"
            onPress={() =>
              router.push({
                pathname: "/garment/photo",
                params: { source: "camera" },
              })
            }
          />
          <Button
            title="Photo library"
            icon="image"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/garment/photo",
                params: { source: "library" },
              })
            }
          />
        </Row>
      </Card>
      <Card>
        <Txt serif style={{ fontSize: 27 }}>
          Voice
        </Txt>
        <Txt muted>Describe several pieces in one short recording.</Txt>
        <Button
          title="Describe with voice"
          icon="mic"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/garment/bulk", params: { voice: "1" } })
          }
        />
      </Card>
      <Card>
        <Txt serif style={{ fontSize: 27 }}>
          Text
        </Txt>
        <Txt muted>Type or paste a list. Choose what to save.</Txt>
        <Button
          title="Type my clothing"
          icon="type"
          variant="secondary"
          onPress={() => router.push("/garment/bulk")}
        />
      </Card>
    </Screen>
  );
}
