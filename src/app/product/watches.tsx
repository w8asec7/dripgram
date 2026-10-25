import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Card,
  Badge,
  Button,
  GarmentImage,
  Empty,
  DemoNote,
  confirmAction,
  ignore,
} from "../../components/ui";
import { useApp, friendlyError } from "../../state/AppProvider";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { money } from "../../components/shopping";
import { watchReached } from "../../services/shopping";
import { PriceWatch, isoNow } from "../../models";
import { theme as t } from "../../theme";
export default function Watches() {
  const { data, execute, services } = useApp();
  const ids = data?.watches.map((w) => w.productId).join(",") || "";
  const resource = useAsyncResource(
    useCallback(
      () => services.shopping.compare(ids ? ids.split(",") : []),
      [services, ids],
    ),
  );
  const products = resource.value ?? [];
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!data) return null;
  async function refresh(w: PriceWatch) {
    if (!services.shopping.refreshProduct) return;
    setRefreshing(w.id);
    setError("");
    try {
      const p = await services.shopping.refreshProduct(w.productId);
      if (p.offer.price === null)
        throw new Error(
          "The provider did not supply a current price. Previous history was preserved.",
        );
      const current = {
        date: isoNow().slice(0, 10),
        price: p.offer.price,
        currency: p.offer.currency,
        checkedAt: p.checkedAt || isoNow(),
      };
      await execute(
        {
          type: "watch.save",
          watch: {
            ...w,
            product: p,
            history: [...w.history, current],
            lastCheckedAt: current.checkedAt,
          },
        },
        "Price checked. Only a verified observation was added.",
      );
      resource.retry();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRefreshing(null);
    }
  }
  return (
    <Screen
      back
      title="Good things can wait."
      subtitle="Your saved products and target prices."
    >
      <DemoNote shopping />
      {resource.loading && <Txt muted>Loading saved listings…</Txt>}
      {!!(error || resource.error) && (
        <Card>
          <Txt>{error || resource.error}</Txt>
          <Button
            title="Retry saved listings"
            variant="secondary"
            onPress={() => {
              setError("");
              resource.retry();
            }}
          />
        </Card>
      )}
      {data.watches.map((w) => {
        const p = w.product || products.find((p) => p.id === w.productId);
        if (!p)
          return (
            <Card key={w.id}>
              <Txt>
                Listing unavailable. Target {money(w.targetPrice)} is saved.
              </Txt>
              <Button
                title="Remove watch"
                variant="ghost"
                onPress={() =>
                  confirmAction(
                    "Remove this watch?",
                    "Remove the unavailable listing from your saved watches.",
                    () => ignore(execute({ type: "watch.delete", id: w.id })),
                  )
                }
              />
            </Card>
          );
        const reached =
          p.offer.price !== null && watchReached(p.offer.price, w.targetPrice);
        const max = Math.max(...w.history.map((h) => h.price), 1);
        return (
          <Card key={w.id}>
            <Row>
              <GarmentImage uri={p.image} style={{ width: 76, height: 90 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Txt style={{ fontWeight: "600" }}>{p.name}</Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  Target {money(w.targetPrice, p.offer.currency)} ·{" "}
                  {p.sample ? "Sample" : "Last checked"}{" "}
                  {money(p.offer.price, p.offer.currency)}
                </Txt>
                <Badge tone={reached ? "sage" : "neutral"}>
                  {p.sample
                    ? reached
                      ? "SAMPLE TARGET REACHED"
                      : "WAITING · DEMO ONLY"
                    : reached
                      ? "TARGET REACHED AT LAST CHECK"
                      : "MANUAL REFRESH ONLY"}
                </Badge>
              </View>
            </Row>
            <Txt muted style={{ fontSize: 11 }}>
              {p.sample
                ? "ILLUSTRATIVE PRICE HISTORY"
                : "OBSERVED PRICE HISTORY · NO BACKGROUND SCHEDULER"}
            </Txt>
            {w.lastCheckedAt && (
              <Txt muted style={{ fontSize: 11 }}>
                Checked {new Date(w.lastCheckedAt).toLocaleString()}
              </Txt>
            )}
            <Row
              style={{
                alignItems: "flex-end",
                justifyContent: "space-around",
                paddingTop: 12,
              }}
            >
              {w.history.slice(-8).map((h, i) => (
                <View
                  key={`${h.checkedAt || h.date}-${i}`}
                  style={{ alignItems: "center", gap: 6, flex: 1 }}
                >
                  <Txt style={{ fontSize: 12 }}>
                    {money(h.price, h.currency || p.offer.currency)}
                  </Txt>
                  <View
                    style={{
                      height: (h.price / max) * 80,
                      width: 24,
                      backgroundColor: t.colors.olive,
                      borderRadius: 6,
                    }}
                  />
                  <Txt muted style={{ fontSize: 10 }}>
                    {h.date.slice(5)}
                  </Txt>
                </View>
              ))}
            </Row>
            <Row>
              <Button
                title="Edit target"
                variant="secondary"
                onPress={() => router.push(`/product/${p.id}`)}
              />
              {!p.sample && (
                <Button
                  title="Refresh price"
                  variant="secondary"
                  loading={refreshing === w.id}
                  onPress={() => ignore(refresh(w))}
                />
              )}
              <Button
                title="Remove watch"
                variant="ghost"
                onPress={() =>
                  confirmAction("Remove price watch?", p.name, () =>
                    ignore(
                      execute(
                        { type: "watch.delete", id: w.id },
                        "Watch removed.",
                      ),
                    ),
                  )
                }
              />
            </Row>
          </Card>
        );
      })}
      {!data.watches.length && (
        <Empty
          title="No rush. No watches yet."
          body="Save a product and a target price. Live prices refresh only when you request it."
          action="Browse finds"
          onPress={() => router.push("/product/search")}
        />
      )}
    </Screen>
  );
}
