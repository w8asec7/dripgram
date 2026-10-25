import { theme as t } from "../theme";
import { fitOptions } from "../utils/clothing";
import React, { useState, useEffect, useRef } from "react";
import { View, Linking } from "react-native";
import { router } from "expo-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Garment,
  GarmentSchema,
  categories,
  categoryGroup,
  primaryCategories,
  categoryLabel,
  styles,
  makeId,
  isoNow,
} from "../models";
import {
  Screen,
  Txt,
  Button,
  Row,
  Field,
  Chips,
  Chip,
  Badge,
  Card,
  ignore,
} from "../components/ui";
import { useApp, friendlyError } from "../state/AppProvider";
import { cameraService } from "../services/camera";
import {
  removeDraftThumbnail,
  prepareLocalImages,
  cleanupTemporaryImage,
  localGarments,
} from "../services/images";
import { cloudImages } from "../services/api";
import { isFriend } from "../repositories/domain";
import { recognitionFields, reviewAnalysis } from "./recognition/review";
import { GarmentReveal } from "../components/GarmentReveal";
export function GarmentForm({
  garment,
  initialSource,
}: {
  garment?: Garment;
  initialSource?: "camera" | "library";
}) {
  const { data, user, execute, services, keepLocalGarment, busy, toast } =
    useApp();
  const requestSequence = useRef(0);
  const pendingInference = useRef<string | null>(null);
  const editedFields = useRef(new Set<string>());
  const [preview, setPreview] = useState<string | null>(null);
  const draftThumbnail = useRef<string | null>(null);
  useEffect(
    () => () => {
      requestSequence.current++;
      if (pendingInference.current)
        ignore(cleanupTemporaryImage(pendingInference.current));
      if (draftThumbnail.current)
        ignore(removeDraftThumbnail(draftThumbnail.current));
    },
    [],
  );
  const [showDetails, setShowDetails] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [analysisSource, setAnalysisSource] = useState<
    "manual" | "meta" | "demo"
  >("manual");
  const defaults: Garment = garment ?? {
    id: makeId("garment"),
    ownerId: user?.id || "demo",
    name: "",
    category: "t-shirt",
    primaryColor: "unknown",
    secondaryColors: [],
    pattern: "solid",
    fit: "unknown",
    styleTags: [],
    brand: null,
    size: data?.profile.preferences.size || null,
    image: null,
    availability: "available",
    favorite: false,
    visibility: "private",
    sharedWith: [],
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
  const {
    control,
    handleSubmit,
    setValue: updateValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<Garment>({
    resolver: zodResolver(GarmentSchema),
    defaultValues: defaults,
  });
  const setValue: typeof updateValue = (key, value, options) => {
    editedFields.current.add(key);
    updateValue(key, value, { shouldDirty: true, ...options });
  };
  const values = useWatch({ control, compute: (values) => values });
  const analyze = async (uri: string, sequence: number) => {
    setAnalyzing(true);
    setPhotoError("");
    try {
      const analysis = await services.ai.analyzeClothing({ uri });
      if (sequence !== requestSequence.current) return;
      const reviewed = reviewAnalysis(
        getValues(),
        analysis,
        editedFields.current,
      );
      // Each field is independent: naming a garment never prevents color/category recognition.
      for (const key of recognitionFields) {
        if (analysis[key] !== undefined && !editedFields.current.has(key))
          updateValue(key, reviewed[key]);
      }
      setAnalysisSource(services.mode === "live" ? "meta" : "demo");
      await cleanupTemporaryImage(uri);
      pendingInference.current = null;
    } catch (e) {
      if (sequence === requestSequence.current) setPhotoError(friendlyError(e));
    } finally {
      if (sequence === requestSequence.current) setAnalyzing(false);
    }
  };
  const choose = async (source: "camera" | "library") => {
    if (!user || analyzing) return;
    setPhotoError("");
    try {
      const result = await (source === "camera"
        ? cameraService.capture()
        : cameraService.selectFromLibrary());
      if (!result) return;
      const sequence = ++requestSequence.current;
      setPreview(result.uri); // Display the chosen photo before compression or network work.
      setAnalysisSource("manual");
      setAnalyzing(true);
      const prepared = await prepareLocalImages(
        result.uri,
        result.width,
        result.height,
        user.id,
        getValues("id"),
      );
      if (sequence !== requestSequence.current) {
        await removeDraftThumbnail(prepared.thumbnailUri);
        await cleanupTemporaryImage(prepared.inferenceUri);
        return;
      }
      if (draftThumbnail.current)
        await removeDraftThumbnail(draftThumbnail.current);
      if (pendingInference.current)
        await cleanupTemporaryImage(pendingInference.current);
      draftThumbnail.current = prepared.thumbnailUri;
      pendingInference.current = prepared.inferenceUri;
      updateValue("image", {
        uri: prepared.thumbnailUri,
        width: prepared.width,
        height: prepared.height,
        source: result.source,
        ownerId: user.id,
        garmentId: getValues("id"),
        syncStatus: "local",
      });
      setPreview(null);
      await cleanupTemporaryImage(result.uri);
      await analyze(prepared.inferenceUri, sequence);
    } catch (e) {
      setPhotoError(friendlyError(e));
      setAnalyzing(false);
    }
  };
  const startedSource = useRef(false);
  useEffect(() => {
    if (initialSource && user && !startedSource.current) {
      startedSource.current = true;
      void choose(initialSource);
    }
    // User chooses the source once; form edits must never reopen the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSource, user?.id]);
  if (!data || !user) return null;
  const submit = () =>
    handleSubmit(
      async (g) => {
        try {
          let updated = g;
          if (g.image && g.image.source !== "bundled")
            updated = {
              ...g,
              image: {
                ...g.image,
                ownerId: user.id,
                garmentId: g.id,
                storagePath: `users/${user.id}/garments/${g.id}/thumbnail.jpg`,
                syncStatus: user.mode === "firebase" ? "pending" : "local",
              },
            };
          if (
            user.mode === "firebase" &&
            garment?.image?.storagePath &&
            !updated.image
          )
            await cloudImages.remove(garment.id);
          await keepLocalGarment(updated);
          draftThumbnail.current = null;
          try {
            await execute({ type: "garment.save", garment: updated });
          } catch {
            toast(
              "Saved on this device. Cloud metadata sync is pending. Retry from the garment page.",
            );
            router.replace(`/garment/${g.id}`);
            return;
          }
          if (
            user.mode === "firebase" &&
            updated.image &&
            updated.image.source !== "bundled"
          ) {
            try {
              const uploaded = await cloudImages.upload(
                g.id,
                updated.image.uri,
              );
              updated = {
                ...updated,
                image: {
                  ...updated.image,
                  storagePath: uploaded.path,
                  syncStatus: "synced",
                  syncedAt: uploaded.syncedAt,
                },
              };
              await execute({ type: "garment.save", garment: updated });
            } catch {
              updated = {
                ...updated,
                image: { ...updated.image!, syncStatus: "failed" },
              };
              await keepLocalGarment(updated);
              toast(
                "Garment saved. Thumbnail stays on this device; cloud sync failed. Use Sync photo to retry.",
              );
              router.replace(`/garment/${g.id}`);
              return;
            }
          }
          await localGarments.remove(user.id, g.id);
          toast(garment ? "Garment updated." : "A new favorite, added.");
          if (garment) router.back();
          else router.replace(`/garment/${g.id}`);
        } catch (e) {
          setPhotoError(friendlyError(e));
        }
      },
      (errors) =>
        setPhotoError(
          `Check these details before saving: ${Object.keys(errors).join(", ")}.`,
        ),
    )();
  return (
    <Screen
      back
      title={garment ? "Edit your piece." : "A new favorite."}
      subtitle="A photo is optional. Every detail is yours to edit."
    >
      <GarmentReveal
        image={preview ? { uri: preview, source: "library" } : values.image}
        analyzing={analyzing}
        recognized={analysisSource === "meta"}
        name={values.name}
        color={values.primaryColor}
        category={categoryLabel(values.category)}
      />
      <Row>
        <Button
          title="Take photo"
          icon="camera"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={analyzing}
          onPress={() => ignore(choose("camera"))}
        />
        <Button
          title="Photo library"
          icon="image"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={analyzing}
          onPress={() => ignore(choose("library"))}
        />
      </Row>
      {values.image && (
        <Button
          title="Remove photo"
          variant="ghost"
          onPress={() => {
            requestSequence.current++;
            setAnalyzing(false);
            setPreview(null);
            setAnalysisSource("manual");
            if (pendingInference.current)
              ignore(cleanupTemporaryImage(pendingInference.current));
            pendingInference.current = null;
            if (draftThumbnail.current)
              ignore(removeDraftThumbnail(draftThumbnail.current));
            draftThumbnail.current = null;
            setValue("image", null);
          }}
        />
      )}

      {!!photoError && (
        <Card>
          <Txt style={{ color: t.colors.error }}>{photoError}</Txt>
          <Button
            title="Open device settings"
            variant="ghost"
            onPress={() => ignore(Linking.openSettings())}
          />
          <Button
            title="Retry analysis"
            disabled={analyzing}
            onPress={() => {
              const uri = pendingInference.current;
              if (uri) ignore(analyze(uri, requestSequence.current));
              else
                setPhotoError(
                  "Choose a photo again, or enter the details manually.",
                );
            }}
          />
          <Button
            title="Dismiss photo error"
            variant="ghost"
            onPress={() => setPhotoError("")}
          />
        </Card>
      )}
      {values.image && (
        <Badge>
          {analysisSource === "meta"
            ? "META RECOGNITION · REVIEW BEFORE SAVING"
            : analysisSource === "demo"
              ? "DEMO · ENTER PHOTO DETAILS MANUALLY"
              : "LOCAL THUMBNAIL · MANUAL DETAILS AVAILABLE"}
        </Badge>
      )}
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Field
            label="Garment name"
            testID="garment-name-input"
            value={field.value}
            onChangeText={(v) => setValue(field.name, v)}
            placeholder="e.g. My favorite olive jacket"
            error={fieldState.error?.message}
          />
        )}
      />
      {!!values.colorReview && (
        <Card>
          <Txt>{values.colorReview}</Txt>
        </Card>
      )}
      {!!values.uncertainFields?.length && (
        <Card>
          <Txt muted>
            Uncertain: {values.uncertainFields.join(", ")}. Please check these
            details.
          </Txt>
        </Card>
      )}
      <Txt>Clothing group</Txt>
      <Chips
        options={[
          ...primaryCategories,
          ...(values.category === "accessories" ? ["Accessories"] : []),
        ]}
        value={categoryGroup(values.category) || "Accessories"}
        onChange={(group) =>
          setValue(
            "category",
            group === "Tops"
              ? "t-shirt"
              : group === "Bottoms"
                ? "trousers"
                : "shoes",
          )
        }
      />
      <Txt muted>Garment type</Txt>
      <Chips
        options={categories
          .filter((c) => categoryGroup(c) === categoryGroup(values.category))
          .map(categoryLabel)}
        value={categoryLabel(values.category)}
        onChange={(v) =>
          setValue(
            "category",
            categories.find((c) => categoryLabel(c) === v)!,
          )
        }
      />
      <Controller
        control={control}
        name="primaryColor"
        render={({ field, fieldState }) => (
          <Field
            label="Primary color"
            value={field.value}
            onChangeText={(v) => setValue(field.name, v)}
            error={fieldState.error?.message}
          />
        )}
      />
      <Field
        label="Fit"
        value={values.fit}
        onChangeText={(v) => setValue("fit", v)}
      />
      <Chips
        options={fitOptions(data?.profile.preferences.clothingMode)}
        value={values.fit}
        onChange={(v) => setValue("fit", v)}
      />
      <Field
        label="Description"
        testID="garment-description-input"
        value={values.description || ""}
        onChangeText={(v) => setValue("description", v)}
        multiline
      />
      <Button
        title={showDetails ? "Fewer details" : "More details & sharing"}
        variant="ghost"
        icon="sliders"
        onPress={() => setShowDetails(!showDetails)}
      />
      {showDetails && (
        <View style={{ gap: t.spacing.lg }}>
          <Field
            key={"secondary-" + analysisSource}
            label="Secondary colors (comma separated)"
            defaultValue={values.secondaryColors.join(", ")}
            onChangeText={(v) =>
              setValue(
                "secondaryColors",
                v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          <Field
            label="Subcategory (optional)"
            value={values.subcategory || ""}
            onChangeText={(v) => setValue("subcategory", v || null)}
          />
          <Field
            label="Material (if known)"
            value={values.material || ""}
            onChangeText={(v) => setValue("material", v || null)}
          />
          <Field
            key={"season-" + analysisSource}
            label="Seasons (comma separated)"
            defaultValue={values.season?.join(", ") || ""}
            onChangeText={(v) =>
              setValue(
                "season",
                v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          <Field
            key={"occasions-" + analysisSource}
            label="Suitable occasions (comma separated)"
            defaultValue={values.occasions?.join(", ") || ""}
            onChangeText={(v) =>
              setValue(
                "occasions",
                v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          <Field
            key={"keywords-" + analysisSource}
            label="Search keywords (comma separated)"
            defaultValue={values.searchKeywords?.join(", ") || ""}
            onChangeText={(v) =>
              setValue(
                "searchKeywords",
                v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          <Field
            label="Silhouette"
            value={values.silhouette || "unknown"}
            onChangeText={(v) => setValue("silhouette", v)}
          />
          <Field
            label="Pattern"
            value={values.pattern}
            onChangeText={(v) => setValue("pattern", v)}
          />
          <Txt>Style tags</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {styles.map((style) => (
              <Chip
                key={style}
                label={style}
                selected={values.styleTags.includes(style)}
                onPress={() =>
                  setValue(
                    "styleTags",
                    values.styleTags.includes(style)
                      ? values.styleTags.filter((x) => x !== style)
                      : [...values.styleTags, style],
                  )
                }
              />
            ))}
          </View>
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label="Brand (optional)"
                value={values.brand || ""}
                onChangeText={(v) => setValue("brand", v || null)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Size (optional)"
                value={values.size || ""}
                onChangeText={(v) => setValue("size", v || null)}
              />
            </View>
          </Row>
          <Card>
            <Txt style={{ fontWeight: "600" }}>
              Your wardrobe, your boundaries.
            </Txt>
            <Chips
              options={["Private", "Selected friends"]}
              value={
                values.visibility === "private" ? "Private" : "Selected friends"
              }
              onChange={(v) => {
                setValue(
                  "visibility",
                  v === "Private" ? "private" : "selected-friends",
                );
                if (v === "Private") setValue("sharedWith", []);
              }}
            />
            {values.visibility === "selected-friends" && (
              <>
                <Txt muted style={{ fontSize: 12 }}>
                  Only selected friends may access this piece. This never opens
                  your entire wardrobe.
                </Txt>
                <Row>
                  {data.directory
                    .filter((p) => isFriend(data, user.id, p.id))
                    .map((p) => (
                      <Chip
                        key={p.id}
                        label={p.displayName.split(" ")[0]}
                        selected={values.sharedWith.includes(p.id)}
                        onPress={() =>
                          setValue(
                            "sharedWith",
                            values.sharedWith.includes(p.id)
                              ? values.sharedWith.filter((id) => id !== p.id)
                              : [...values.sharedWith, p.id],
                          )
                        }
                      />
                    ))}
                </Row>
              </>
            )}
          </Card>
        </View>
      )}
      <Button
        title={garment ? "Save changes" : "Add to my wardrobe"}
        icon="check"
        loading={busy || analyzing || isSubmitting}
        onPress={() => ignore(submit())}
      />
    </Screen>
  );
}
