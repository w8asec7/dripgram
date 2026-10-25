import { theme as t } from "../../theme";
import React, { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Card,
  GarmentImage,
  Button,
  DemoNote,
  Empty,
  Badge,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { money } from "../../components/shopping";
import { discount } from "../../services/shopping";
export default function Compare() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { services } = useApp();
  const resource = useAsyncResource(
    useCallback(
      () => services.shopping.compare(ids?.split(",") ?? []),
      [services, ids],
    ),
  );
  const selected = resource.value ?? [];
  if (resource.loading)
    return (
      <Screen back>
        <Txt>Comparing your finds…</Txt>
      </Screen>
    );
  if (resource.error)
    return (
      <Screen back>
        <Empty
          title="Couldn’t compare these products"
          body={resource.error}
          action="Retry"
          onPress={resource.retry}
        />
      </Screen>
    );
  return (
    <Screen
      back
      title="A considered comparison."
      subtitle="Find what fits your wardrobe, and your budget."
    >
      <DemoNote shopping />
      {selected.length < 2 ? (
        <Empty
          title="A little perspective helps."
          body="Select two to four finds from search to compare them side by side."
          action="Browse finds"
          onPress={() => router.replace("/product/search")}
        />
      ) : (
        <ScrollView
          horizontal
          contentContainerStyle={{ gap: 12 }}
          showsHorizontalScrollIndicator
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            {selected.map((p) => (
              <Card key={p.id} style={{ width: 190, padding: 14 }}>
                <GarmentImage uri={p.image} style={{ height: 180 }} />
                <Txt
                  numberOfLines={2}
                  style={{ minHeight: 44, fontWeight: "600" }}
                >
                  {p.name}
                </Txt>
                {[
                  ["Sample price", money(p.offer.price, p.offer.currency)],
                  ["Retailer", p.offer.retailer],
                  [
                    "Discount",
                    discount(p) !== null ? `${discount(p)}%` : "Not provided",
                  ],
                  ["Condition", p.offer.condition || "Not provided"],
                  ["Shipping", p.offer.shipping || "Not provided"],
                  [
                    "Wardrobe fit",
                    p.compatibility === null
                      ? "Not scored"
                      : `${p.compatibility}% (sample)`,
                  ],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    style={{
                      gap: 4,
                      minHeight: 65,
                      borderTopWidth: 1,
                      borderTopColor: t.colors.border,
                      paddingTop: 10,
                    }}
                  >
                    <Txt muted style={{ fontSize: 11 }}>
                      {label}
                    </Txt>
                    <Txt style={{ fontSize: 13 }}>{value}</Txt>
                  </View>
                ))}
                <Badge>
                  {p.sample ? "SIMILAR · SAMPLE" : "SIMILAR · LIVE LISTING"}
                </Badge>
                <Button
                  title="View product"
                  variant="secondary"
                  onPress={() => router.push(`/product/${p.id}`)}
                />
              </Card>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
