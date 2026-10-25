import React, { useRef } from "react";
import { shoppingMeasurement } from "../services/performance";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Product } from "../models";
import { GarmentImage, Txt, Row, Badge, Button } from "./ui";
import { discount } from "../services/shopping";
export const money = (n: number | null, currency = "USD") =>
  n === null
    ? "Price not provided"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);
export function ProductCard({
  product,
  selected,
  onCompare,
  fill = false,
}: {
  product: Product;
  selected?: boolean;
  onCompare?: () => void;
  fill?: boolean;
}) {
  const d = discount(product);
  const imageStart = useRef(0);
  const measured = useRef(false);
  return (
    <View
      testID={`product-card-${product.id}`}
      style={{ width: fill ? "100%" : "48%", gap: 8 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={product.name}
        onPress={() => router.push(`/product/${product.id}`)}
      >
        <GarmentImage
          uri={product.image}
          label={product.name}
          onLoad={() => {
            if (!measured.current) {
              measured.current = true;
              shoppingMeasurement({
                phase: "product_image",
                ms: performance.now() - imageStart.current,
              });
            }
          }}
          style={{ aspectRatio: 0.9, borderRadius: 12 }}
        />
        {d !== null && (
          <View style={{ position: "absolute", top: 10, left: 10 }}>
            <Badge tone="neutral">
              −{d}% {product.sample ? "SAMPLE" : "OFF"}
            </Badge>
          </View>
        )}
      </Pressable>
      <Txt muted numberOfLines={1} style={{ fontSize: 11 }}>
        {product.offer.retailer || "Merchant not provided"}
      </Txt>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/product/${product.id}`)}
      >
        <Txt
          numberOfLines={2}
          style={{
            fontSize: 13,
            fontWeight: "500",
            lineHeight: 18,
            minHeight: 36,
          }}
        >
          {product.name}
        </Txt>
      </Pressable>
      <Row style={{ gap: 6 }}>
        <Txt style={{ fontWeight: "600" }}>
          {money(product.offer.price, product.offer.currency)}
        </Txt>
        {!!product.offer.originalPrice && (
          <Txt
            muted
            style={{ fontSize: 11, textDecorationLine: "line-through" }}
          >
            {money(product.offer.originalPrice)}
          </Txt>
        )}
      </Row>
      {onCompare && (
        <Button
          title={selected ? "Added ✓" : "Compare +"}
          variant="secondary"
          onPress={onCompare}
          style={{ minHeight: 40, paddingVertical: 8, paddingHorizontal: 10 }}
        />
      )}
    </View>
  );
}
