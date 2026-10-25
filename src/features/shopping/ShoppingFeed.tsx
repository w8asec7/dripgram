import { useGrid } from "../../theme/responsive";
import { shoppingMeasurement } from "../../services/performance";
import { demoApiRequest, syncDemoWardrobe } from "../../services/demoLive";
import { products as samples } from "../../mocks/seed";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { ActivityIndicator, FlatList, View, TextInput } from "react-native";
import { router, useLocalSearchParams, useIsFocused } from "expo-router";
import {
  FeedRequest,
  FeedPage,
  FeedPageSchema,
  uniqueProducts,
} from "../../../shared/feed";
import { apiRequest } from "../../services/api";
import { useApp, friendlyError } from "../../state/AppProvider";
import { filterProducts } from "../../services/shopping";
import {
  Screen,
  Txt,
  Button,
  Card,
  Chips,
  Field,
  Row,
  ignore,
  IconButton,
  Icon,
} from "../../components/ui";
import { ProductCard } from "../../components/shopping";
import {
  Product,
  primaryCategories,
  PrimaryCategory,
  makeId,
  isoNow,
} from "../../models";
import { theme as t } from "../../theme";
const cache = new Map<string, { page: FeedPage; at: number }>();
const pending = new Map<string, Promise<FeedPage>>();
export function ShoppingFeed({
  mode = "discover",
  back = false,
}: {
  mode?: FeedRequest["mode"];
  back?: boolean;
}) {
  const { data, user, services, execute, busy } = useApp();
  const grid = useGrid("discover");
  const focused = useIsFocused();
  const completedKey = useRef("");
  const failed = useRef(false);
  const params = useLocalSearchParams<{
    query?: string;
    group?: string;
    postId?: string;
    reason?: string;
  }>();
  const [queryText, setQueryText] = useState(params.query || ""),
    [minPrice, setMinPrice] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const bootstrapping = useRef(false);
  const loadedProducts = useRef<Product[]>([]);
  const rotation = useRef(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]),
    [next, setNext] = useState<number | null>(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const [category, setCategory] = useState(params.group || "All"),
    [price, setPrice] = useState(""),
    [brand, setBrand] = useState(""),
    [color] = useState(""),
    [sale, setSale] = useState(mode === "clearance"),
    [showFilters, setShowFilters] = useState(false),
    [filterVersion, setFilterVersion] = useState(0),
    [applied, setApplied] = useState<FeedRequest["filters"]>({
      query: params.query || "",
      group: primaryCategories.includes(params.group as PrimaryCategory)
        ? (params.group as PrimaryCategory)
        : undefined,
    }),
    [compare, setCompare] = useState<string[]>([]);
  const readyAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (readyAt.current !== null) {
      shoppingMeasurement({
        phase: "react_commit",
        ms: performance.now() - readyAt.current,
        count: products.length,
      });
      readyAt.current = null;
    }
  }, [products]);
  const lock = useRef(false),
    generation = useRef(0),
    autoPages = useRef(0),
    loadedCount = useRef(0);
  const inventoryKey =
    data?.garments
      .map((g) => g.id + g.updatedAt)
      .sort()
      .join("|") || "";
  const prefsKey = JSON.stringify(data?.profile.preferences);
  const key = JSON.stringify([
    user?.id,
    services.mode,
    mode,
    inventoryKey,
    prefsKey,
    applied,
    filterVersion,
  ]);
  const load = useCallback(
    async (page: number, refresh = false) => {
      if (!data || !user || lock.current || !focused) return;
      const actionStart = performance.now();
      lock.current = true;
      const current = generation.current;
      const round = rotation.current;
      const pageKey = key + ":" + round + ":" + page;

      failed.current = false;
      setLoading(true);
      setError("");
      try {
        const hit = cache.get(pageKey);
        const cached = !refresh && hit && Date.now() - hit.at < 30 * 60000;
        if (!cached && user.mode === "demo" && services.mode === "live")
          await syncDemoWardrobe();
        shoppingMeasurement({
          phase: "action_to_request",
          ms: performance.now() - actionStart,
        });
        let task = pending.get(pageKey);
        if (!task) {
          task = cached
            ? Promise.resolve(hit.page)
            : services.mode === "live"
              ? (user.mode === "demo" ? demoApiRequest : apiRequest)(
                  "/v1/shopping/feed",
                  FeedPageSchema,
                  {
                    mode,
                    filters: applied,
                    page,
                    refresh,
                    rotation: round,
                  },
                )
              : Promise.resolve({
                  products: rotatedSamples(round, {
                    ...applied,
                    onSale: mode === "clearance" || applied.onSale,
                  }).slice(page * 36, page * 36 + 36),
                  nextPage:
                    (page + 1) * 36 <
                    rotatedSamples(round, {
                      ...applied,
                      onSale: mode === "clearance" || applied.onSale,
                    }).length
                      ? page + 1
                      : null,
                  reason:
                    mode === "complete"
                      ? "Sample selections to explore alongside your demo wardrobe."
                      : "A curated sample catalog. Sign in for current retailer results.",
                  query: "sample catalog",
                  source: "sample" as const,
                  planSource: "rules" as const,
                  checkedAt: isoNow(),
                  message: "Sample products and prices.",
                });
          pending.set(pageKey, task);
        }
        const result = await task;
        cache.set(pageKey, { page: result, at: Date.now() });
        pending.delete(pageKey);
        if (current !== generation.current) return;
        loadedProducts.current = uniqueProducts(
          page === 0
            ? result.products
            : [...loadedProducts.current, ...result.products],
        );
        loadedCount.current = loadedProducts.current.length;
        readyAt.current = performance.now();
        setProducts(loadedProducts.current);
        shoppingMeasurement({
          phase: cached ? "client_cache_results" : "results_ready",
          ms: performance.now() - actionStart,
          count: result.products.length,
        });
        requestAnimationFrame(() =>
          shoppingMeasurement({
            phase: "next_frame",
            ms: performance.now() - actionStart,
            count: result.products.length,
          }),
        );
        setReasons((prior) => ({
          ...(page === 0 ? {} : prior),
          ...Object.fromEntries(
            result.products.map((p) => [
              p.id,
              result.productReasons?.[p.id] || result.reason,
            ]),
          ),
        }));
        if (page === 0) completedKey.current = key;
        setNext(result.nextPage);
        setReason(result.reason);
        setChecked(result.checkedAt);
        return result;
      } catch (e) {
        if (current === generation.current) {
          failed.current = true;
          setError(friendlyError(e));
        }
      } finally {
        pending.delete(pageKey);
        if (current === generation.current) {
          lock.current = false;
          setLoading(false);
        }
      }
    },
    [data, user, key, services.mode, mode, applied, focused],
  );
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  }, [load]);
  useEffect(() => {
    if (!focused || completedKey.current === key) {
      lock.current = false;
      bootstrapping.current = false;
      return;
    }
    const version = ++generation.current;
    bootstrapping.current = true;
    lock.current = false;
    autoPages.current = 0;
    loadedCount.current = 0;
    void Promise.resolve().then(() => {
      if (generation.current !== version) return;
      setProducts([]);
      setNext(0);
      setError("");
      return (async () => {
        try {
          let result = await loader.current(0);
          let batches = 1;
          while (
            generation.current === version &&
            result &&
            result.nextPage !== null &&
            mode !== "clearance" &&
            loadedCount.current < 72 &&
            batches < 3
          ) {
            result = await loader.current(result.nextPage);
            batches++;
          }
        } finally {
          if (generation.current === version) bootstrapping.current = false;
        }
      })();
    });
    return () => {
      generation.current = version + 1;
    };
  }, [key, mode, focused]);
  if (!data || !user) return null;
  const append = () => {
    if (
      focused &&
      !failed.current &&
      !error &&
      loadedCount.current > 0 &&
      next !== null &&
      next > 0 &&
      !lock.current &&
      !bootstrapping.current
    ) {
      autoPages.current++;
      void load(next);
    }
  };
  const refreshFeed = async () => {
    if (lock.current) return;
    rotation.current = (rotation.current + 1) % 8;
    setRefreshing(true);
    bootstrapping.current = true;
    cache.clear();
    const version = generation.current;
    try {
      let result = await load(0, true);
      let batches = 1;
      while (
        generation.current === version &&
        result &&
        result.nextPage !== null &&
        mode !== "clearance" &&
        loadedCount.current < 72 &&
        batches < 3
      ) {
        result = await load(result.nextPage);
        batches++;
      }
    } finally {
      setRefreshing(false);
      bootstrapping.current = false;
    }
  };
  const header = (
    <View style={{ gap: t.spacing.md, paddingBottom: t.spacing.md }}>
      {!!params.postId && !back && (
        <Button
          title="Back to inspiration"
          icon="arrow-left"
          variant="ghost"
          onPress={() => router.dismissTo(`/social/post/${params.postId}`)}
        />
      )}
      {!!params.reason && <Txt muted>{params.reason}</Txt>}
      <Row style={{ gap: 4, flexWrap: "nowrap", width: "100%", maxWidth: 900 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.colors.surface,
            borderRadius: 12,
            paddingLeft: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
          }}
        >
          <Icon name="search" size={17} color={t.colors.muted} />
          <TextInput
            accessibilityLabel="Search clothing"
            placeholder="Search clothes, brands, styles"
            placeholderTextColor={t.colors.muted}
            value={queryText}
            onChangeText={setQueryText}
            returnKeyType="search"
            keyboardAppearance="dark"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              paddingHorizontal: 8,
              color: t.colors.ink,
              fontSize: 14,
            }}
            onSubmitEditing={() => {
              setApplied((old) => ({ ...old, query: queryText }));
              setFilterVersion((v) => v + 1);
            }}
          />
          <IconButton
            name="arrow-right"
            label="Search"
            onPress={() => {
              setApplied((old) => ({ ...old, query: queryText }));
              setFilterVersion((v) => v + 1);
            }}
          />
        </View>
        <IconButton
          name="shopping-bag"
          label={`Shopping collection, ${data.cart.length} items`}
          onPress={() => router.push("/product/cart")}
        />
        <IconButton
          name="bookmark"
          label="Product watches"
          onPress={() => router.push("/product/watches")}
        />
      </Row>
      <Row between style={{ gap: 4, flexWrap: "nowrap" }}>
        <Row style={{ gap: 6 }}>
          <Button
            compact
            title={showFilters ? "Close filters" : "Filter finds"}
            icon="sliders"
            variant="secondary"
            onPress={() => setShowFilters(!showFilters)}
          />
          <Button
            compact
            title={sale ? "On sale ✓" : "On sale"}
            variant={sale ? "primary" : "ghost"}
            onPress={() => {
              setSale(!sale);
              setApplied((old) => ({ ...old, onSale: !sale }));
            }}
          />
          {!!applied.query && (
            <Button
              compact
              title="For you"
              variant="ghost"
              onPress={() => {
                setQueryText("");
                setCategory("All");
                setSale(false);
                setApplied({ query: "" });
                router.setParams({
                  query: "",
                  group: "",
                  postId: "",
                  reason: "",
                });
              }}
            />
          )}
        </Row>
        <IconButton
          name="refresh-cw"
          label="Refresh feed"
          disabled={loading}
          onPress={() => {
            void refreshFeed();
          }}
        />
      </Row>
      <Txt muted style={{ fontSize: 11 }}>
        {services.mode === "demo"
          ? "Sample catalog · Demo prices"
          : "Live SerpApi listings · Verify prices with retailer"}
        {category !== "All" ? ` · ${category}` : ""}
      </Txt>
      {mode === "complete" && !!reason && (
        <Txt muted style={{ fontSize: 12 }}>
          {reason}
        </Txt>
      )}
      {showFilters && (
        <Card style={{ maxWidth: 760, width: "100%" }}>
          <Chips
            options={["All", ...primaryCategories]}
            value={category}
            onChange={setCategory}
          />
          <Row style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Minimum price (USD)"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Maximum price (USD)"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </Row>
          <Field label="Brand" value={brand} onChangeText={setBrand} />

          <Chips
            options={["All listings", "Verified sales only"]}
            value={sale ? "Verified sales only" : "All listings"}
            onChange={(v) => setSale(v === "Verified sales only")}
          />
          <Button
            title="Apply shopping filters"
            onPress={() => {
              if (
                (price &&
                  (!Number.isFinite(Number(price)) || Number(price) < 0)) ||
                (minPrice &&
                  (!Number.isFinite(Number(minPrice)) ||
                    Number(minPrice) < 0)) ||
                (price && minPrice && Number(minPrice) > Number(price))
              ) {
                setError("Enter a valid price range.");
                return;
              }
              setApplied({
                query: queryText,
                minPrice: minPrice ? Number(minPrice) : undefined,
                group:
                  category === "All"
                    ? undefined
                    : (category as PrimaryCategory),
                maxPrice: price ? Number(price) : undefined,
                brand: brand || undefined,
                color: color || undefined,
                onSale: sale,
              });
              setFilterVersion((v) => v + 1);
              setShowFilters(false);
            }}
          />
        </Card>
      )}
      {compare.length >= 2 && (
        <Button
          title={`Compare ${compare.length} finds`}
          onPress={() =>
            router.push({
              pathname: "/product/compare",
              params: { ids: compare.join(",") },
            })
          }
        />
      )}
      {!!checked && (
        <Txt muted style={{ fontSize: 11 }}>
          {products.length} finds loaded · Last checked{" "}
          {new Date(checked).toLocaleString()} · Prices may change.
        </Txt>
      )}
    </View>
  );
  return (
    <Screen
      maxWidth={grid.maxWidth}
      back={back}
      scroll={false}
      title={
        mode === "complete"
          ? "For your wardrobe"
          : mode === "clearance"
            ? "On sale"
            : "Discover"
      }
    >
      <FlatList
        key={grid.columns}
        testID="shopping-feed"
        data={products}
        numColumns={grid.columns}
        keyExtractor={(p) => p.id}
        style={{ flex: 1, minHeight: 0 }}
        columnWrapperStyle={{ gap: grid.gap, alignItems: "flex-start" }}
        contentContainerStyle={{
          gap: t.spacing.md,
          paddingBottom: t.spacing.xxxl,
        }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ width: grid.cardWidth, gap: t.spacing.sm }}>
            <ProductCard
              fill
              product={item}
              selected={compare.includes(item.id)}
            />
            {mode === "complete" && !!reasons[item.id] && (
              <Txt muted numberOfLines={3} style={{ fontSize: 11 }}>
                {reasons[item.id]}
              </Txt>
            )}
            <Row between style={{ gap: 0, flexWrap: "nowrap" }}>
              <IconButton
                name={
                  data.cart.some((c) => c.id === item.id)
                    ? "check"
                    : "shopping-bag"
                }
                label={
                  data.cart.some((c) => c.id === item.id)
                    ? "In collection"
                    : "Add to collection"
                }
                color={
                  data.cart.some((c) => c.id === item.id)
                    ? t.colors.sage
                    : undefined
                }
                disabled={busy || data.cart.some((c) => c.id === item.id)}
                onPress={() =>
                  ignore(
                    execute(
                      {
                        type: "cart.add",
                        item: {
                          id: item.id,
                          ownerId: user.id,
                          product: item,
                          createdAt: isoNow(),
                        },
                      },
                      "Added to your shopping collection.",
                    ),
                  )
                }
              />
              <IconButton
                name="bookmark"
                label={
                  data.watches.some((w) => w.productId === item.id)
                    ? "Product watched"
                    : "Watch product price"
                }
                disabled={
                  busy || data.watches.some((w) => w.productId === item.id)
                }
                onPress={() =>
                  ignore(
                    execute(
                      {
                        type: "watch.save",
                        watch: {
                          id: makeId("watch"),
                          ownerId: user.id,
                          productId: item.id,
                          product: item,
                          targetPrice: Math.max(
                            1,
                            item.offer.price ?? data.profile.preferences.budget,
                          ),
                          history: [],
                          createdAt: isoNow(),
                        },
                      },
                      "Product watch saved.",
                    ),
                  )
                }
              />
              <IconButton
                name="copy"
                label={
                  compare.includes(item.id)
                    ? "Remove from comparison"
                    : "Compare product"
                }
                color={compare.includes(item.id) ? t.colors.sage : undefined}
                onPress={() =>
                  setCompare((ids) =>
                    ids.includes(item.id)
                      ? ids.filter((id) => id !== item.id)
                      : ids.length < 4
                        ? [...ids, item.id]
                        : ids,
                  )
                }
              />
            </Row>
          </View>
        )}
        onScroll={(event) => {
          const { contentOffset, layoutMeasurement, contentSize } =
            event.nativeEvent;
          if (
            contentOffset.y > 0 &&
            contentOffset.y + layoutMeasurement.height >=
              contentSize.height - 1000
          )
            append();
        }}
        scrollEventThrottle={160}
        onMomentumScrollEnd={(event) => {
          const { contentOffset, layoutMeasurement, contentSize } =
            event.nativeEvent;
          if (
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 1000
          )
            append();
        }}
        onEndReached={append}
        onEndReachedThreshold={0.8}
        refreshing={refreshing}
        onRefresh={() => {
          void refreshFeed();
        }}
        initialNumToRender={grid.columns * 3}
        maxToRenderPerBatch={grid.columns * 2}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !error ? (
            <Card>
              <Txt>No matching finds in this selection.</Txt>
              <Txt muted>
                Try another category, raise your budget, or turn sale-only off.
              </Txt>
            </Card>
          ) : undefined
        }
        ListFooterComponent={
          <View style={{ gap: t.spacing.md }}>
            {loading && !products.length && (
              <Row style={{ gap: t.spacing.md }}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    accessibilityLabel="Loading product"
                    style={{ flex: 1, gap: t.spacing.sm }}
                  >
                    <View
                      style={{
                        aspectRatio: 0.8,
                        backgroundColor: t.colors.border,
                        borderRadius: t.radius.lg,
                      }}
                    />
                    <View
                      style={{
                        height: 14,
                        width: "80%",
                        backgroundColor: t.colors.border,
                        borderRadius: t.radius.sm,
                      }}
                    />
                  </View>
                ))}
              </Row>
            )}
            {loading && (
              <ActivityIndicator
                accessibilityLabel="Loading finds"
                color={t.colors.sage}
              />
            )}
            {!!error && (
              <Card>
                <Txt accessibilityRole="alert">{error}</Txt>
                <Button
                  title="Retry feed"
                  onPress={() => void load(next ?? 0)}
                />
              </Card>
            )}
            {!loading && next !== null && (
              <Button
                title="Load more finds"
                variant="secondary"
                onPress={() => void load(next)}
              />
            )}
            {!loading && next === null && (
              <Txt muted>
                You’re all caught up. Change filters or refresh later for more.
              </Txt>
            )}
          </View>
        }
      />
    </Screen>
  );
}
const rotatedSamples = (
  rotation: number,
  filters: import("../../services/shopping").SearchRequest,
) => {
  const products = filterProducts(samples, filters);
  if (!products.length) return [];
  const offset = (rotation * 36) % products.length;
  return [...products.slice(offset), ...products.slice(0, offset)];
};
