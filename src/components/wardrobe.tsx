import { GarmentFallback } from "./GarmentFallback";
import React from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Garment, Outfit, Occasion } from "../models";
import { GarmentImage, Txt, Row, Badge, Icon, Card } from "./ui";
import { theme as t } from "../theme";
export function GarmentCard({
  garment,
  onPress,
  selected,
  fill = false,
}: {
  garment: Garment;
  onPress?: () => void;
  selected?: boolean;
  fill?: boolean;
}) {
  return (
    <Pressable
      testID={`garment-card-${garment.id}`}
      accessibilityRole="button"
      accessibilityLabel={garment.name}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress || (() => router.push(`/garment/${garment.id}`))}
      style={{ width: fill ? "100%" : "48%", gap: 8 }}
    >
      <View
        style={{
          borderWidth: selected ? 2 : 0,
          borderColor: t.colors.sage,
          borderRadius: t.radius.lg,
          overflow: "hidden",
        }}
      >
        {!garment.image ? (
          <View style={{ aspectRatio: 0.92 }}>
            <GarmentFallback garment={garment} />
          </View>
        ) : (
          <GarmentImage
            image={garment.image}
            label={garment.name}
            style={{
              aspectRatio: 0.92,
              borderRadius: t.radius.lg,
              backgroundColor: t.colors.sand,
            }}
          />
        )}
        {garment.favorite && (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              backgroundColor: t.colors.surface,
              borderRadius: 16,
              padding: 6,
            }}
          >
            <Icon name="heart" size={13} color={t.colors.sage} />
          </View>
        )}
        {selected && (
          <View style={{ position: "absolute", bottom: 10, right: 10 }}>
            <Badge>Selected ✓</Badge>
          </View>
        )}
      </View>
      <Txt
        numberOfLines={2}
        style={{ fontSize: 14, fontWeight: "500", lineHeight: 19 }}
      >
        {garment.name}
      </Txt>
      {garment.image?.source === "bundled" && (
        <Txt muted style={{ fontSize: 10 }}>
          Representative photo
        </Txt>
      )}
      <Txt muted style={{ fontSize: 11, lineHeight: 16 }}>
        {garment.primaryColor} ·{" "}
        {garment.fit !== "unknown" ? garment.fit : garment.category}
      </Txt>
    </Pressable>
  );
}
export function OutfitCollage({
  outfit,
  garments,
  large = false,
}: {
  outfit: Outfit;
  garments: Garment[];
  large?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: t.spacing.sm,
        padding: t.spacing.sm,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        height: large ? 300 : 220,
      }}
    >
      {outfit.items.map((item) => {
        const g = garments.find((g) => g.id === item.garmentId);
        return g ? (
          <View key={g.id} style={{ flex: 1, gap: 8 }}>
            {g.image ? (
              <GarmentImage
                image={g.image}
                label={g.name}
                style={{ flex: 1, borderRadius: t.radius.md }}
              />
            ) : (
              <GarmentFallback garment={g} compact />
            )}
            <Txt numberOfLines={2} style={{ fontSize: 11 }}>
              {g.name}
            </Txt>
          </View>
        ) : null;
      })}
    </View>
  );
}
export function OccasionCard({ occasion }: { occasion: Occasion }) {
  const d = new Date(`${occasion.date}T12:00:00`);
  return (
    <Card onPress={() => router.push(`/occasion/${occasion.id}`)}>
      <Row>
        <View
          style={{
            backgroundColor: t.colors.sageLight,
            borderRadius: 14,
            padding: 12,
            minWidth: 58,
            alignItems: "center",
          }}
        >
          <Txt
            style={{
              fontSize: 10,
              color: t.colors.sage,
              textTransform: "uppercase",
            }}
          >
            {d.toLocaleDateString("en-US", { month: "short" })}
          </Txt>
          <Txt serif style={{ fontSize: 27, lineHeight: 31 }}>
            {d.getDate()}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontWeight: "600" }}>{occasion.name}</Txt>
          <Txt muted style={{ fontSize: 12 }}>
            {occasion.dressCode || occasion.type} · {occasion.time}
          </Txt>
          <Txt muted style={{ fontSize: 11 }}>
            {occasion.participantIds.length} people invited
          </Txt>
        </View>
        <Icon name="arrow-up-right" size={18} />
      </Row>
    </Card>
  );
}
