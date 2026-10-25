import React from "react";
import { View } from "react-native";
import { Garment, categoryGroup } from "../models";
import { Icon, Txt } from "./ui";
import { theme as t } from "../theme";
const swatches: Record<string, string> = {
  red: "#A7363C",
  burgundy: "#782D3D",
  black: "#2C2D2D",
  white: "#FCFBF6",
  cream: "#E6DDCA",
  beige: "#CBB894",
  blue: "#587795",
  "light blue": "#A2BDD1",
  navy: "#344357",
  grey: "#91918D",
  gray: "#91918D",
  sage: "#9AA487",
  olive: "#747B52",
  green: "#5D7860",
  brown: "#94745A",
  pink: "#CF9FA2",
  yellow: "#DCC36A",
  purple: "#9584AC",
  charcoal: "#4A4D50",
};
export function GarmentFallback({
  garment,
  compact = false,
}: {
  garment: Pick<Garment, "name" | "category" | "primaryColor" | "fit">;
  compact?: boolean;
}) {
  const group = categoryGroup(garment.category);
  return (
    <View
      accessibilityLabel={`${garment.name}, ${garment.primaryColor}, ${garment.fit}, photo not added`}
      style={{
        flex: 1,
        minHeight: compact ? 80 : 160,
        backgroundColor: t.colors.sand,
        borderRadius: t.radius.lg,
        padding: compact ? 8 : 18,
        justifyContent: "center",
        alignItems: "center",
        gap: compact ? 6 : 14,
      }}
    >
      <View
        style={{
          width: compact ? 28 : 44,
          height: compact ? 28 : 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: t.colors.border,
          backgroundColor:
            swatches[garment.primaryColor.toLowerCase()] || t.colors.sageLight,
        }}
      />
      <Icon
        name={
          group === "Bottoms"
            ? "columns"
            : group === "Shoes"
              ? "navigation"
              : "shopping-bag"
        }
        color={t.colors.sage}
        size={compact ? 20 : 34}
      />
      <Txt
        numberOfLines={2}
        serif
        style={{ fontSize: compact ? 14 : 20, textAlign: "center" }}
      >
        {garment.name}
      </Txt>
      {!compact && (
        <Txt muted style={{ fontSize: 11 }}>
          {garment.fit !== "unknown" ? garment.fit : group || garment.category}{" "}
          · add a photo anytime
        </Txt>
      )}
    </View>
  );
}
