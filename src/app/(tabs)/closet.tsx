import { useGrid } from "../../theme/responsive";
import React, { useState, useMemo } from "react";
import { View, FlatList } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  IconButton,
  Chips,
  Field,
  Button,
  Empty,
  Badge,
} from "../../components/ui";
import { GarmentCard } from "../../components/wardrobe";
import { useApp } from "../../state/AppProvider";
import {
  primaryCategories,
  categoryGroup,
  categories,
  categoryLabel,
} from "../../models";
import { filterGarments } from "../../utils/wardrobe";
import { theme as t } from "../../theme";
export default function Closet() {
  const { data } = useApp();
  const grid = useGrid("closet");
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState("");
  const [color, setColor] = useState("Any color"),
    [subtype, setSubtype] = useState("All");
  const [favorites, setFavorites] = useState(false),
    [advanced, setAdvanced] = useState(false);
  const filtered = useMemo(
    () =>
      filterGarments(
        (data?.garments ?? []).filter(
          (g) => category === "Accessories" || categoryGroup(g.category),
        ),
        {
          search,
          category: subtype !== "All" ? subtype : category,
          color,
          favorites,
        },
      ),
    [data?.garments, search, category, color, subtype, favorites],
  );
  if (!data) return null;
  const header = (
    <View style={{ gap: 12, paddingBottom: 16 }}>
      <Row style={{ flexWrap: "nowrap", gap: 8 }}>
        <Button
          style={{ flex: 1, paddingHorizontal: 12 }}
          title="Saved looks"
          variant="secondary"
          onPress={() => router.push("/outfit/saved")}
        />
        <Button
          style={{ flex: 1, paddingHorizontal: 12 }}
          title="Delete clothes"
          variant="ghost"
          onPress={() => router.push("/garment/manage")}
        />
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field
            label="Search your wardrobe"
            placeholder="Find a favorite…"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <IconButton
          name="sliders"
          label="More closet filters"
          onPress={() => setAdvanced(!advanced)}
        />
        <IconButton
          name="heart"
          label="Filter favorites"
          color={favorites ? t.colors.sage : undefined}
          onPress={() => setFavorites(!favorites)}
        />
      </Row>
      <Chips
        options={["All", ...primaryCategories]}
        value={category}
        onChange={(v) => {
          setCategory(v);
          setSubtype("All");
        }}
      />
      {advanced && (
        <View style={{ gap: 12 }}>
          <Chips
            options={[
              "All",
              ...categories
                .filter(
                  (c) => category === "All" || categoryGroup(c) === category,
                )
                .map(categoryLabel),
            ]}
            value={subtype}
            onChange={setSubtype}
          />
          <Chips
            options={[
              "Any color",
              ...new Set(data.garments.map((g) => g.primaryColor)),
            ]}
            value={color}
            onChange={setColor}
          />
          <Button
            title="Show legacy accessories"
            variant="ghost"
            onPress={() => {
              setCategory("Accessories");
              setSubtype("All");
            }}
          />
          <Button
            title="Clear filters"
            variant="ghost"
            onPress={() => {
              setCategory("All");
              setSubtype("All");
              setSearch("");
              setColor("Any color");
              setFavorites(false);
            }}
          />
        </View>
      )}
      <Row between>
        <Txt muted style={{ fontSize: 12 }}>
          {filtered.length} pieces
        </Txt>
        <Badge>PRIVATE BY DEFAULT</Badge>
      </Row>
    </View>
  );
  return (
    <Screen
      maxWidth={grid.maxWidth}
      scroll={false}
      title="Your closet."
      subtitle={`${data.garments.length} pieces. Endless ways to be you.`}
      action={
        <IconButton
          name="plus"
          label="Add garment"
          onPress={() => router.push("/garment/new")}
        />
      }
    >
      <FlatList
        key={grid.columns}
        data={filtered}
        keyExtractor={(g) => g.id}
        numColumns={grid.columns}
        columnWrapperStyle={{ gap: grid.gap }}
        contentContainerStyle={{ gap: 22, paddingBottom: 32 }}
        style={{ flex: 1 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ width: grid.cardWidth }}>
            <GarmentCard garment={item} fill />
          </View>
        )}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Empty
            title="Room for something you love."
            body="Try another filter, or add clothing by photo, voice or text."
            action="Add clothing"
            onPress={() => router.push("/garment/new")}
          />
        }
        ListFooterComponent={
          <Button
            title="Build a look from your closet"
            icon="layers"
            variant="secondary"
            onPress={() => router.push("/outfit/build")}
          />
        }
      />
    </Screen>
  );
}
