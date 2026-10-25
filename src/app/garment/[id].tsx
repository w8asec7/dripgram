import { GarmentFallback } from "../../components/GarmentFallback";
import { theme as t } from "../../theme";
import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Button,
  Card,
  GarmentImage,
  IconButton,
  Badge,
  Empty,
  confirmAction,
  ignore,
} from "../../components/ui";
import { cloudImages } from "../../services/api";
import { localGarments } from "../../services/images";
import { useApp } from "../../state/AppProvider";
import { categoryLabel } from "../../models";
export default function GarmentDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, execute, busy, user, keepLocalGarment, toast } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const garment = data?.garments.find((g) => g.id === id);
  if (!data || !garment)
    return (
      <Screen back>
        <Empty
          title="Piece not found"
          body="It may have been removed. Your other favorites are in your closet."
          action="Open closet"
          onPress={() => router.replace("/(tabs)/closet")}
        />
      </Screen>
    );
  const sync = async () => {
    if (!user) return;
    setSyncing(true);
    setSyncError("");
    try {
      await execute({ type: "garment.save", garment });
      if (!garment.image) {
        toast("Garment details synced.");
        return;
      }
      const result = await cloudImages.upload(garment.id, garment.image.uri);
      const updated = {
        ...garment,
        image: {
          ...garment.image,
          storagePath: result.path,
          ownerId: user.id,
          garmentId: garment.id,
          syncStatus: "synced" as const,
          syncedAt: result.syncedAt,
        },
      };
      await execute(
        { type: "garment.save", garment: updated },
        "Thumbnail synced privately.",
      );
      await localGarments.remove(user.id, garment.id);
    } catch (e) {
      await keepLocalGarment({
        ...garment,
        image: garment.image
          ? { ...garment.image, syncStatus: "failed" }
          : null,
      });
      setSyncError(
        e instanceof Error
          ? e.message
          : "Cloud sync failed. Your local thumbnail is safe.",
      );
    } finally {
      setSyncing(false);
    }
  };
  const remove = async () => {
    if (
      user?.mode === "firebase" &&
      garment.image?.storagePath &&
      garment.image.syncStatus === "synced"
    )
      await cloudImages.remove(garment.id);
    await execute(
      { type: "garment.delete", id: garment.id },
      "Garment removed.",
    );
    router.replace("/(tabs)/closet");
  };
  return (
    <Screen back>
      {!garment.image ? (
        <View style={{ aspectRatio: 1 }}>
          <GarmentFallback garment={garment} />
        </View>
      ) : (
        <GarmentImage
          image={garment.image}
          label={garment.name}
          style={{ aspectRatio: 1, borderRadius: 24 }}
        />
      )}
      {garment.image?.source === "bundled" && (
        <Txt muted style={{ fontSize: 12 }}>
          Representative photograph · exact shade, fit and brand may differ.
        </Txt>
      )}
      {!!garment.image && garment.image.source !== "bundled" && (
        <Card>
          <Badge>
            {garment.image.syncStatus === "synced"
              ? "PRIVATE THUMBNAIL SYNCED"
              : garment.image.syncStatus === "failed"
                ? "SAVED ON THIS DEVICE · SYNC FAILED"
                : user?.mode === "demo"
                  ? "LOCAL DEMO THUMBNAIL"
                  : "SAVED ON THIS DEVICE · SYNC PENDING"}
          </Badge>
          {!!syncError && <Txt>{syncError}</Txt>}
          {user?.mode === "firebase" && (
            <Button
              title="Sync photo"
              loading={syncing}
              variant="secondary"
              onPress={() => ignore(sync())}
            />
          )}
        </Card>
      )}
      {user?.mode === "firebase" && !garment.image && (
        <Button
          title="Sync garment details"
          loading={syncing}
          variant="secondary"
          onPress={() => ignore(sync())}
        />
      )}
      {!!syncError && !garment.image && <Txt>{syncError}</Txt>}
      <Row between>
        <Badge>{categoryLabel(garment.category).toUpperCase()}</Badge>
        <IconButton
          name="heart"
          color={garment.favorite ? t.colors.sage : undefined}
          label={garment.favorite ? "Remove favorite" : "Add favorite"}
          onPress={() =>
            ignore(
              execute(
                {
                  type: "garment.save",
                  garment: { ...garment, favorite: !garment.favorite },
                },
                garment.favorite
                  ? "Removed from favorites."
                  : "Added to favorites.",
              ),
            )
          }
        />
      </Row>
      <Txt serif style={{ fontSize: 26, lineHeight: 31 }}>
        {garment.name}
      </Txt>
      <Txt muted>
        {garment.primaryColor} · {garment.fit} ·{" "}
        {garment.brand || "Brand not added"}
      </Txt>
      <Row>
        {garment.styleTags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        {!!garment.size && <Badge tone="neutral">Size {garment.size}</Badge>}
      </Row>
      <Row>
        <Button
          title="Edit piece"
          icon="edit-2"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() =>
            router.push({
              pathname: "/garment/edit",
              params: { id: garment.id },
            })
          }
        />
        <Button
          title="Build a look"
          icon="layers"
          style={{ flex: 1 }}
          onPress={() =>
            router.push({
              pathname: "/outfit/build",
              params: { requiredGarmentId: garment.id, origin: "closet" },
            })
          }
        />
      </Row>
      <Button
        title="Find something similar"
        variant="ghost"
        icon="search"
        onPress={() =>
          router.push({
            pathname: "/product/search",
            params: {
              category: garment.category,
              query: garment.primaryColor,
              maxPrice: String(data.profile.preferences.budget),
              garmentId: garment.id,
            },
          })
        }
      />
      <Card>
        <Txt style={{ fontWeight: "600" }}>Saved looks with this piece</Txt>
        {data.outfits
          .filter((o) => o.items.some((i) => i.garmentId === garment.id))
          .map((o) => (
            <Button
              key={o.id}
              title={o.name}
              variant="ghost"
              onPress={() => router.push(`/outfit/${o.id}`)}
            />
          ))}
        {!data.outfits.some((o) =>
          o.items.some((i) => i.garmentId === garment.id),
        ) && <Txt muted>No saved outfits use this piece yet.</Txt>}
      </Card>
      <Row between>
        <Txt muted style={{ fontSize: 12 }}>
          {garment.visibility === "private"
            ? "🔒 Only you can see this piece"
            : `Shared with ${garment.sharedWith.length} selected friend(s)`}
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          Pattern: {garment.pattern}
        </Txt>
      </Row>
      <Button
        title="Delete garment"
        variant="ghost"
        loading={busy}
        onPress={() =>
          confirmAction(
            "Delete this garment?",
            "This removes it from your wardrobe and saved looks. Historical wear records and intentionally shared occasion snapshots remain.",
            () =>
              ignore(
                remove().catch((error) =>
                  toast(
                    error instanceof Error
                      ? error.message
                      : "Could not remove this garment. Retry when connected.",
                  ),
                ),
              ),
          )
        }
      />
      <View style={{ height: 8 }} />
    </Screen>
  );
}
