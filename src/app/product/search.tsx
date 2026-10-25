import { theme as t } from "../../theme";
import React, { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Field,
  Chips,
  Button,
  Card,
  Chip,
  DemoNote,
  Empty,
  GarmentImage,
  Badge,
  ignore,
} from "../../components/ui";
import { ProductCard } from "../../components/shopping";
import { useApp, friendlyError } from "../../state/AppProvider";
import {
  Product,
  primaryCategories,
  categoryGroup,
  PrimaryCategory,
  categoryLabel,
  Category,
  makeId,
} from "../../models";
import { SearchRequest, SearchRequestSchema } from "../../services/shopping";
import {
  prepareInferenceImage,
  cleanupTemporaryImage,
  resolveThumbnail,
} from "../../services/images";
import { cameraService } from "../../services/camera";
type ProductSearchParams = {
  query?: string;
  category?: Category;
  sale?: string;
  maxPrice?: string;
  size?: string;
  savedId?: string;
  garmentId?: string;
};
export default function ProductSearch() {
  const params = useLocalSearchParams<ProductSearchParams>();
  const { data } = useApp();
  if (!data) return null;
  return <ProductSearchForm key={JSON.stringify(params)} params={params} />;
}
function ProductSearchForm({ params }: { params: ProductSearchParams }) {
  const { data, user, services, execute, busy } = useApp();
  const reference = data?.garments.find((g) => g.id === params.garmentId);
  const saved = data?.searches.find((s) => s.id === params.savedId);
  const [query, setQuery] = useState(
    saved?.query ??
      (reference
        ? reference.searchKeywords?.[0] ||
          `${reference.primaryColor} ${reference.fit} ${reference.category}`
        : params.query) ??
      "",
  );
  const [category, setCategory] = useState(
    saved?.category ?? reference?.category ?? params.category ?? "All",
  );
  const [size, setSize] = useState(saved?.size ?? params.size ?? "");
  const [color, setColor] = useState(saved?.color ?? "");
  const [brand, setBrand] = useState(saved?.brand ?? "");
  const [retailer, setRetailer] = useState(saved?.retailer ?? "");
  const [maxPrice, setMaxPrice] = useState(
    String(saved?.maxPrice ?? params.maxPrice ?? ""),
  );
  const [minPrice, setMinPrice] = useState(String(saved?.minPrice ?? ""));
  const [onSale, setOnSale] = useState(saved?.onSale ?? params.sale === "true");
  const [sort, setSort] = useState(saved?.sort ?? "relevance");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(services.mode !== "live");
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [wardrobe, setWardrobe] = useState(false);
  const [photo, setPhoto] = useState<string | null>(
    reference?.image?.uri || null,
  );
  const [compare, setCompare] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | undefined>();
  const [fit, setFit] = useState("");
  const [searchStyle, setSearchStyle] = useState("");
  const [occasion, setOccasion] = useState("");
  const filters = (): SearchRequest => {
    if (
      (maxPrice !== "" &&
        (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)) ||
      (minPrice !== "" &&
        (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0))
    )
      throw new Error("Prices must be zero or a positive number.");
    return SearchRequestSchema.parse({
      query,
      fit: fit.trim() || undefined,
      style: searchStyle.trim() || undefined,
      occasion: occasion.trim() || undefined,
      category:
        category !== "All" &&
        !primaryCategories.includes(category as PrimaryCategory)
          ? category
          : undefined,
      group: primaryCategories.includes(category as PrimaryCategory)
        ? category
        : undefined,
      clothingMode: data?.profile.preferences.clothingMode,
      size: size.trim() || undefined,
      color: color.trim() || undefined,
      brand: brand.trim() || undefined,
      retailer: retailer.trim() || undefined,
      maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
      minPrice: minPrice === "" ? undefined : Number(minPrice),
      onSale,
      sort,
    });
  };
  const search = async () => {
    setError("");
    setLoading(true);
    try {
      const f = filters();
      if (f.minPrice && f.maxPrice !== undefined && f.minPrice > f.maxPrice)
        throw new Error("Minimum price should be below your maximum.");
      const r = photo
        ? await services.shopping.visualSearch({ uri: photo, filters: f })
        : await services.shopping.search(f);
      setResults(r.products);
      setMessage(r.message || "");
      setCheckedAt(r.checkedAt);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (services.mode === "live") return;
    let active = true;
    Promise.resolve()
      .then(() =>
        photo
          ? services.shopping.visualSearch({ uri: photo, filters: filters() })
          : services.shopping.search(filters()),
      )
      .then((r) => {
        if (active) {
          setResults(r.products);
          setMessage(r.message || "");
          setCheckedAt(r.checkedAt);
        }
      })
      .catch((e) => {
        if (active) setError(friendlyError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Initial route values are fixed by this keyed form; later edits use Search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let active = true;
    if (reference?.image && reference.image.source !== "bundled")
      resolveThumbnail(reference.image)
        .then((uri) => {
          if (active) setPhoto(uri);
        })
        .catch((e) => {
          if (active) setError(friendlyError(e));
        });
    return () => {
      active = false;
    };
  }, [reference?.image]);
  useEffect(
    () => () => {
      if (photo) ignore(cleanupTemporaryImage(photo));
    },
    [photo],
  );
  if (!data || !user) return null;
  return (
    <Screen
      back
      title={onSale ? "Clearance radar." : "Find your kind of good."}
      subtitle="Similar pieces. Considered prices. Your preferences."
    >
      <DemoNote shopping />
      {!!checkedAt && (
        <Txt muted style={{ fontSize: 11 }}>
          Checked {new Date(checkedAt).toLocaleString()}
        </Txt>
      )}
      <Row>
        <Button
          title="From closet"
          icon="grid"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => setWardrobe(!wardrobe)}
        />
        <Button
          title="Upload image"
          icon="image"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() =>
            ignore(
              cameraService
                .selectFromLibrary()
                .then(async (p) => {
                  if (p) {
                    const prepared = await prepareInferenceImage(
                      p.uri,
                      p.width,
                      p.height,
                    );
                    setPhoto(prepared.uri);
                    await cleanupTemporaryImage(p.uri);
                  }
                })
                .catch((e) => setError(friendlyError(e))),
            )
          }
        />
      </Row>
      {wardrobe && (
        <Card>
          <Txt>Choose a reference piece</Txt>
          <Row>
            {data.garments.slice(0, 18).map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                onPress={() => {
                  setQuery(
                    g.searchKeywords?.[0] ||
                      `${g.primaryColor} ${g.fit} ${g.category}`,
                  );
                  setCategory(g.category);
                  setWardrobe(false);
                  if (g.image && g.image.source !== "bundled")
                    ignore(
                      resolveThumbnail(g.image)
                        .then(setPhoto)
                        .catch((e) => setError(friendlyError(e))),
                    );
                  else
                    setPhoto(
                      services.mode === "demo" ? g.image?.uri || null : null,
                    );
                }}
              />
            ))}
          </Row>
        </Card>
      )}
      {photo && (
        <Row>
          <GarmentImage uri={photo} style={{ width: 70, height: 80 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Badge>
              {services.mode === "live"
                ? "VISUAL SEARCH WITH GOOGLE LENS"
                : "SAMPLE VISUAL SEARCH"}
            </Badge>
            <Txt muted style={{ fontSize: 12 }}>
              {services.mode === "live"
                ? "This reference is shared with SerpApi only when you tap Search live listings. The bucket stays private."
                : "Demo similarity is illustrative, not image recognition."}
            </Txt>
          </View>
          <Button
            title="Remove"
            variant="ghost"
            onPress={() => setPhoto(null)}
          />
        </Row>
      )}
      <Field
        label="Product or style"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. beige trousers"
        onSubmitEditing={() => ignore(search())}
      />
      <Chips
        options={["All", ...primaryCategories]}
        value={category === "All" ? "All" : categoryGroup(category) || category}
        onChange={setCategory}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Field
            label="Maximum price ($)"
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="decimal-pad"
            placeholder="Any"
          />
        </View>
        <Button
          title={advanced ? "Fewer filters" : "More filters"}
          icon="sliders"
          variant="ghost"
          onPress={() => setAdvanced(!advanced)}
        />
      </Row>
      {advanced && (
        <Card>
          <Field
            label="Desired fit"
            value={fit}
            onChangeText={setFit}
            placeholder="Any fit"
          />
          <Field
            label="Style"
            value={searchStyle}
            onChangeText={setSearchStyle}
            placeholder="Any style"
          />
          <Field
            label="Shopping occasion"
            value={occasion}
            onChangeText={setOccasion}
            placeholder="Optional"
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label="Size"
                value={size}
                onChangeText={setSize}
                placeholder="Any"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Color"
                value={color}
                onChangeText={setColor}
                placeholder="Any"
              />
            </View>
          </Row>
          <Field
            label="Brand"
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Form"
          />
          <Field
            label="Retailer"
            value={retailer}
            onChangeText={setRetailer}
            placeholder="Any"
          />
          <Field
            label="Minimum price ($)"
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="decimal-pad"
          />
          <Chips
            options={["All prices", "On sale"]}
            value={onSale ? "On sale" : "All prices"}
            onChange={(v) => setOnSale(v === "On sale")}
          />
          <Txt>Sort by</Txt>
          <Chips
            options={["relevance", "price", "discount"]}
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
          />
        </Card>
      )}
      <Button
        title={
          services.mode === "live"
            ? "Search live listings"
            : "Search sample listings"
        }
        icon="search"
        loading={loading}
        onPress={() => ignore(search())}
      />
      <Row>
        <Button
          title="Save this search"
          variant="ghost"
          icon="bookmark"
          loading={busy}
          onPress={() => {
            try {
              const f = filters();
              ignore(
                execute(
                  {
                    type: "search.save",
                    search: {
                      ...f,
                      id: makeId("search"),
                      ownerId: user.id,
                      name:
                        query.trim() ||
                        `${onSale ? "Clearance" : "All"} ${category === "All" ? "finds" : categoryLabel(category)}`,
                    },
                  },
                  "Search saved to Discover.",
                ),
              );
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
        />
        {saved && (
          <Button
            title="Remove saved search"
            variant="ghost"
            onPress={() =>
              ignore(
                execute(
                  { type: "search.delete", id: saved.id },
                  "Saved search removed.",
                ),
              )
            }
          />
        )}
      </Row>
      {!!error && (
        <Card>
          <Txt style={{ color: t.colors.error }}>{error}</Txt>
          <Button title="Retry search" onPress={() => ignore(search())} />
        </Card>
      )}
      {!!message && (
        <Txt muted style={{ fontSize: 11 }}>
          {message}
        </Txt>
      )}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading products" />
      ) : (
        <>
          <Row between>
            <Txt muted style={{ fontSize: 12 }}>
              {results.length} {services.mode === "live" ? "live" : "sample"}{" "}
              finds
            </Txt>
            {compare.length > 0 && (
              <Button
                title={`Compare ${compare.length}`}
                variant="secondary"
                disabled={compare.length < 2}
                onPress={() =>
                  router.push({
                    pathname: "/product/compare",
                    params: { ids: compare.join(",") },
                  })
                }
              />
            )}
          </Row>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            {results.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selected={compare.includes(p.id)}
                onCompare={() => {
                  if (compare.includes(p.id))
                    setCompare(compare.filter((id) => id !== p.id));
                  else if (compare.length < 4) setCompare([...compare, p.id]);
                  else
                    setError(
                      "Compare up to four products. Remove one to add another.",
                    );
                }}
              />
            ))}
          </View>
          {!results.length && !error && (
            <Empty
              title="Nothing quite like that yet."
              body={
                services.mode === "live"
                  ? "Try a broader search or increase your price range. Missing-price listings are excluded when a price limit is set."
                  : "Try a broader search or increase your price range. Sample catalog contains 12 items."
              }
              action="Reset filters"
              onPress={() => {
                setQuery("");
                setCategory("All");
                setColor("");
                setBrand("");
                setRetailer("");
                setSize("");
                setMinPrice("");
                setMaxPrice("");
                setOnSale(false);
                setResults([]);
                setMessage(
                  services.mode === "live"
                    ? "Filters cleared. Tap Search live listings to browse."
                    : "Filters cleared. Tap Search sample listings to browse.",
                );
              }}
            />
          )}
        </>
      )}
    </Screen>
  );
}
