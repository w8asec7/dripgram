import React from "react";
import { View } from "react-native";
import { ClothingMode } from "../models";
import { Txt, Row, Chip } from "./ui";
export function ClothingPreference({
  value,
  onChange,
}: {
  value?: ClothingMode;
  onChange: (value: ClothingMode) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Txt style={{ fontWeight: "600" }}>Clothing preference</Txt>
      <Row>
        {(
          [
            ["men", "Men’s"],
            ["women", "Women’s"],
          ] as const
        ).map(([mode, label]) => (
          <Chip
            key={mode}
            label={label}
            selected={value === mode}
            onPress={() => onChange(mode)}
          />
        ))}
      </Row>
      <Txt muted style={{ fontSize: 12 }}>
        Personalizes styling and shopping. You can always explore any clothing.
      </Txt>
    </View>
  );
}
