import React, { useState, useCallback } from "react";
import { Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Badge,
  GarmentImage,
  Button,
  Field,
  Card,
  DemoNote,
  Empty,
  ignore,
} from "../../components/ui";
import { money } from "../../components/shopping";
import { useApp, friendlyError } from "../../state/AppProvider";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { discount } from "../../services/shopping";
import { makeId, isoNow } from "../../models";
import { AdviceSchema } from "../../../shared/protocol";
import { z } from "zod";
export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, services, execute, busy, toast } = useApp();
  const resource = useAsyncResource(
    useCallback(() => services.shopping.details(id), [services, id]),
  );
  const product = resource.value;
  const watch = data?.watches.find((w) => w.productId === id);
  const [target, setTarget] = useState(watch ? String(watch.targetPrice) : "");
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState<z.infer<typeof AdviceSchema> | null>(
    null,
  );
  const [advising, setAdvising] = useState(false);
  if (resource.loading)
    return (
      <Screen back>
        <Txt>Finding your piece…</Txt>
      </Screen>
    );
  if (resource.error)
    return (
      <Screen back>
        <Empty
          title="Couldn’t load this product"
          body={resource.error}
          action="Retry"
          onPress={resource.retry}
        />
      </Screen>
    );
  if (!data || !user || !product)
    return (
      <Screen back>
        <Empty
          title="This find isn’t here."
          body="Search again to check current listings."
        />
      </Screen>
    );
  const d = discount(product);
  const sample = product.sample;
  const url = product.offer.url;
  const googleLink = url ? new URL(url).hostname.endsWith("google.com") : false;
  return (
    <Screen back>
      <GarmentImage
        uri={product.image}
        label={product.name}
        style={{ height: 320, borderRadius: 24 }}
      />
      <Button
        title={
          data.cart.some((item) => item.id === product.id)
            ? "In your shopping collection ✓"
            : "Add to shopping collection"
        }
        icon="shopping-bag"
        variant="secondary"
        disabled={busy || data.cart.some((item) => item.id === product.id)}
        onPress={() =>
          ignore(
            execute(
              {
                type: "cart.add",
                item: {
                  id: product.id,
                  ownerId: user.id,
                  product,
                  createdAt: isoNow(),
                },
              },
              "Added to your shopping collection.",
            ),
          )
        }
      />
      <Row between>
        <Badge>{sample ? "SAMPLE LISTING" : "LIVE SERPAPI LISTING"}</Badge>
        {d !== null && (
          <Badge tone="warning">
            {d}% OFF{sample ? " · SAMPLE" : ""}
          </Badge>
        )}
      </Row>
      <Txt serif style={{ fontSize: 26, lineHeight: 31 }}>
        {product.name}
      </Txt>
      <Txt muted>
        {[product.brand, product.offer.retailer].filter(Boolean).join(" · ") ||
          "Merchant not provided"}
      </Txt>
      <Row>
        <Txt serif style={{ fontSize: 25 }}>
          {money(product.offer.price, product.offer.currency)}
        </Txt>
        {!!product.offer.originalPrice && (
          <Txt muted style={{ textDecorationLine: "line-through" }}>
            {money(product.offer.originalPrice, product.offer.currency)}
          </Txt>
        )}
      </Row>
      <DemoNote shopping source={sample ? "sample" : "live"} />
      {product.checkedAt && (
        <Txt muted style={{ fontSize: 11 }}>
          Checked {new Date(product.checkedAt).toLocaleString()}
        </Txt>
      )}
      <Card>
        <Txt style={{ fontWeight: "600" }}>
          A similar piece, not an exact match
        </Txt>
        {sample && product.similarity !== null ? (
          <Txt muted>
            {Math.round(product.similarity * 100)}% illustrative similarity ·{" "}
            {product.compatibility}% sample wardrobe compatibility
          </Txt>
        ) : (
          <Txt muted>
            Compare the details and retailer sizing. No exact-match or AI
            confidence claim is made.
          </Txt>
        )}
        <Row>
          {product.color && <Badge>{product.color}</Badge>}
          {!!product.sizes.length && <Badge>{product.sizes.join(" · ")}</Badge>}
        </Row>
        <Txt muted style={{ fontSize: 12 }}>
          Condition: {product.offer.condition || "Not provided"}
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          Shipping: {product.offer.shipping || "Not provided by retailer"}
        </Txt>
        {product.rating != null && (
          <Txt muted>
            Rating: {product.rating}
            {product.reviewCount != null
              ? ` · ${product.reviewCount} reviews`
              : ""}
          </Txt>
        )}
      </Card>
      <Button
        title={googleLink ? "Open product listing" : "Visit retailer"}
        icon="external-link"
        disabled={!url}
        onPress={() => {
          if (url)
            ignore(
              Linking.openURL(url).catch(() =>
                toast("Could not open this listing. Please retry."),
              ),
            );
        }}
      />
      <Txt muted style={{ fontSize: 11 }}>
        {sample
          ? "This illustrative item and sample price are not verified offers."
          : "Prices and availability may change. Verify the current offer and shipping on the linked site."}
      </Txt>
      {!sample && services.shopping.advice && (
        <Card>
          <Txt serif style={{ fontSize: 26 }}>
            Does it fit your wardrobe?
          </Txt>
          <Button
            title="Ask Meta about this addition"
            variant="secondary"
            loading={advising}
            onPress={() => {
              setAdvising(true);
              setError("");
              ignore(
                services.shopping.advice!(product.id)
                  .then(setAdvice)
                  .catch((e) => setError(friendlyError(e)))
                  .finally(() => setAdvising(false)),
              );
            }}
          />
          {advice && (
            <>
              <Badge>{advice.recommendation.toUpperCase()}</Badge>
              <Txt>{advice.summary}</Txt>
              <Txt muted>
                {advice.matchingGarmentIds.length} owned pieces complement this
                · {advice.similarOwnedIds.length} similar pieces already owned
              </Txt>
            </>
          )}
        </Card>
      )}
      {!!error && (
        <Card>
          <Txt>{error}</Txt>
          <Button
            title="Dismiss error"
            variant="ghost"
            onPress={() => setError("")}
          />
        </Card>
      )}
      <Card>
        <Badge>
          {sample ? "SAMPLE PRICE WATCH" : "SAVED PRODUCT · MANUAL PRICE WATCH"}
        </Badge>
        <Txt serif style={{ fontSize: 27 }}>
          {watch ? "Your target, your pace." : "Worth waiting for?"}
        </Txt>
        <Field
          label="Target price ($)"
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="e.g. 35"
          error={error}
        />
        <Button
          title={watch ? "Update price watch" : "Save price watch"}
          icon="bookmark"
          loading={busy}
          onPress={() => {
            const price = Number(target);
            if (!Number.isFinite(price) || price <= 0) {
              setError("Enter a target price above zero.");
              return;
            }
            setError("");
            const history =
              watch?.history ??
              (product.offer.price === null
                ? []
                : [
                    {
                      date: isoNow().slice(0, 10),
                      price: product.offer.price,
                      currency: product.offer.currency,
                      checkedAt: product.checkedAt,
                    },
                  ]);
            const save = sample
              ? services.shopping.history(product.id)
              : Promise.resolve(history);
            ignore(
              save.then((h) =>
                execute(
                  {
                    type: "watch.save",
                    watch: {
                      id: watch?.id || makeId("watch"),
                      ownerId: user.id,
                      productId: product.id,
                      product,
                      history: h,
                      targetPrice: price,
                      createdAt: watch?.createdAt || isoNow(),
                      lastCheckedAt: product.checkedAt,
                    },
                  },
                  sample
                    ? "Sample watch saved. No live monitoring is active."
                    : "Product saved. Refresh prices manually from Watches.",
                ),
              ),
            );
          }}
        />
        <Txt muted style={{ fontSize: 11 }}>
          {sample
            ? "Sample history only. No background monitoring or real price alerts."
            : "Only observed prices are retained. Background monitoring is not enabled."}
        </Txt>
        {watch && (
          <>
            <Button
              title={
                sample ? "View sample price history" : "View price history"
              }
              variant="secondary"
              onPress={() => router.push("/product/watches")}
            />
            <Button
              title="Remove watch"
              variant="ghost"
              onPress={() =>
                ignore(
                  execute(
                    { type: "watch.delete", id: watch.id },
                    "Watch removed.",
                  ),
                )
              }
            />
          </>
        )}
      </Card>
      <Button
        title="Compare with other finds"
        variant="secondary"
        onPress={() => router.push("/product/search")}
      />
    </Screen>
  );
}
