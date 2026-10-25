import React, { useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { useApp, friendlyError } from "../../state/AppProvider";
import {
  Screen,
  Txt,
  Card,
  Row,
  Button,
  GarmentImage,
  Badge,
  Empty,
  ignore,
} from "../../components/ui";
import { money } from "../../components/shopping";
import { apiRequest } from "../../services/api";
import { demoApiRequest, syncDemoWardrobe } from "../../services/demoLive";
import { CartSuggestionsSchema } from "../../../shared/cart";
import { z } from "zod";
import { categoryGroup } from "../../models";
export default function ShoppingCollection() {
  const { data, user, execute, services } = useApp();
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [suggestions, setSuggestions] = useState<z.infer<
      typeof CartSuggestionsSchema
    > | null>(null);
  if (!data || !user) return null;
  const match = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      if (services.mode === "live") {
        if (user.mode === "demo") await syncDemoWardrobe();
        setSuggestions(
          await (user.mode === "demo" ? demoApiRequest : apiRequest)(
            "/v1/shopping/cart-suggestions",
            CartSuggestionsSchema,
            {},
          ),
        );
      } else {
        const bottom = data.cart.some(
          (c) => categoryGroup(c.product.category || "") === "Bottoms",
        );
        setSuggestions({
          source: "sample",
          suggestions: [
            {
              query: bottom
                ? "relaxed neutral cotton shirt"
                : "beige relaxed trousers",
              reason:
                "A sample complementary category to explore alongside your collection.",
              group: bottom ? "Tops" : "Bottoms",
            },
          ],
        });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen
      back
      title="Your shopping collection."
      subtitle="Pieces you’re considering. Checkout happens with the retailer."
    >
      {!data.cart.length && (
        <Empty
          title="Keep your good finds together."
          body="Save a product from Discover to start your collection."
          action="Explore Discover"
          onPress={() => router.replace("/(tabs)/discover")}
        />
      )}
      {data.cart.map((item) => (
        <Card key={item.id}>
          <Row>
            <GarmentImage
              uri={item.product.image}
              label={item.product.name}
              style={{ width: 90, height: 110 }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Txt style={{ fontWeight: "600" }}>{item.product.name}</Txt>
              <Txt muted>
                {item.product.offer.retailer || "Retailer not supplied"}
              </Txt>
              <Txt>
                {money(item.product.offer.price, item.product.offer.currency)}
              </Txt>
              {item.product.sample && <Badge>SAMPLE PRODUCT</Badge>}
            </View>
          </Row>
          <Row>
            <Button
              title="View retailer"
              icon="external-link"
              variant="secondary"
              disabled={!item.product.offer.url}
              onPress={() => {
                if (item.product.offer.url)
                  ignore(Linking.openURL(item.product.offer.url));
              }}
            />
            <Button
              title="Remove from collection"
              variant="ghost"
              onPress={() =>
                ignore(execute({ type: "cart.remove", id: item.id }))
              }
            />
          </Row>
        </Card>
      ))}
      {!!data.cart.length && (
        <Button
          title="Find Something That Matches"
          icon="layers"
          loading={loading}
          onPress={() => void match()}
        />
      )}
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      {suggestions && (
        <>
          <Badge>
            {suggestions.source === "meta"
              ? "META · COLLECTION MATCHES"
              : "SAMPLE CATEGORY SUGGESTIONS"}
          </Badge>
          {suggestions.suggestions.map((s) => (
            <Card key={s.query}>
              <Txt>{s.reason}</Txt>
              <Button
                title={`Shop ${s.group.toLowerCase()}`}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/discover",
                    params: {
                      query: s.query,
                      group: s.group,
                      reason: s.reason,
                    },
                  })
                }
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
