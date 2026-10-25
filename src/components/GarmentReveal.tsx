import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Garment } from "../models";
import { theme as t } from "../theme";
import { GarmentImage, Badge, Row, Txt } from "./ui";
/** Motion only runs while work is in flight; results are immediately editable. */
export function GarmentReveal({
  image,
  analyzing,
  recognized,
  name,
  color,
  category,
}: {
  image: Garment["image"];
  analyzing: boolean;
  recognized: boolean;
  name: string;
  color: string;
  category: string;
}) {
  const reduced = useReducedMotion();
  const scan = useSharedValue(0);
  useEffect(() => {
    if (analyzing && !reduced)
      scan.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
    else {
      cancelAnimation(scan);
      scan.value = 0;
    }
    return () => cancelAnimation(scan);
  }, [analyzing, reduced, scan]);
  const scanning = useAnimatedStyle(() => ({
    opacity: 0.2 + scan.value * 0.5,
    transform: [{ translateY: scan.value * 210 }],
  }));
  return (
    <View style={{ gap: t.spacing.md }}>
      <View
        style={{
          overflow: "hidden",
          borderRadius: t.radius.lg,
          backgroundColor: t.colors.sand,
        }}
      >
        <GarmentImage
          image={image}
          label="Selected garment preview"
          style={{ height: 260 }}
        />
        {analyzing && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 20,
                left: 20,
                right: 20,
                height: 2,
                backgroundColor: t.colors.sage,
              },
              scanning,
            ]}
          />
        )}
      </View>
      {analyzing ? (
        <Row>
          <ActivityIndicator color={t.colors.sage} />
          <Txt accessibilityLiveRegion="polite">
            Reading your piece… Details stay editable.
          </Txt>
        </Row>
      ) : recognized ? (
        <Animated.View
          key={name + color}
          entering={
            reduced ? undefined : FadeInDown.duration(t.duration.normal)
          }
          style={{ gap: t.spacing.sm }}
        >
          <Txt serif style={{ fontSize: t.type.title }}>
            {name}
          </Txt>
          <Row>
            <Badge>{color}</Badge>
            <Badge>{category}</Badge>
          </Row>
        </Animated.View>
      ) : null}
    </View>
  );
}
