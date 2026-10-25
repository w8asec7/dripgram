import { ClothingPreference } from "../../components/ClothingPreference";
import React, { useState, useRef } from "react";
import { cameraService } from "../../services/camera";
import {
  prepareLocalImages,
  cleanupTemporaryImage,
} from "../../services/images";
import { apiRequest, imagePayload } from "../../services/api";
import { SyncResultSchema } from "../../../shared/protocol";
import { View } from "react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Profile, ProfileSchema, styles, makeId } from "../../models";
import {
  Screen,
  Txt,
  Field,
  Row,
  Chip,
  Button,
  Card,
  ignore,
  Avatar,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
export default function EditProfile() {
  const { data, user, execute, busy } = useApp();
  const [photoError, setPhotoError] = useState("");
  const [picking, setPicking] = useState(false);
  const photoDraft = useRef<string | null>(null);
  const photoVersion = useRef(makeId("avatar"));
  const { control, setValue, handleSubmit } = useForm<Profile>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: data?.profile,
  });
  const values = useWatch({ control, compute: (values) => values });
  if (!data || !values.preferences) return null;
  const submit = () =>
    handleSubmit(async (profile) => {
      setPhotoError("");
      try {
        let photo = profile.photo;
        if (photoDraft.current && user?.mode === "firebase") {
          await apiRequest("/v1/profile/photo", SyncResultSchema, {
            version: photoVersion.current,
            image: await imagePayload(photoDraft.current),
          });
          photo = `avatar:${photoVersion.current}`;
        }
        await execute(
          { type: "profile", profile: { ...profile, photo } },
          "Profile updated.",
        );
        router.back();
      } catch (e) {
        setPhotoError(
          e instanceof Error
            ? e.message
            : "Could not save your profile. Retry.",
        );
      }
    })();
  const choosePhoto = async () => {
    if (!user) return;
    setPicking(true);
    setPhotoError("");
    try {
      const result = await cameraService.selectFromLibrary();
      if (!result) return;
      const prepared = await prepareLocalImages(
        result.uri,
        result.width,
        result.height,
        user.id,
        "profile-avatar",
      );
      await cleanupTemporaryImage(prepared.inferenceUri);
      await cleanupTemporaryImage(result.uri);
      photoDraft.current = prepared.thumbnailUri;
      photoVersion.current = makeId("avatar");
      setValue("photo", prepared.thumbnailUri);
    } catch (e) {
      setPhotoError(
        e instanceof Error ? e.message : "Could not load this profile photo.",
      );
    } finally {
      setPicking(false);
    }
  };
  return (
    <Screen back title="Uniquely you.">
      <Avatar
        name={values.displayName || "You"}
        photo={values.photo}
        userId={user?.id}
        size={80}
      />
      <Button
        title="Choose profile photo"
        icon="image"
        variant="secondary"
        loading={picking}
        onPress={() => void choosePhoto()}
      />
      {!!photoError && <Txt accessibilityRole="alert">{photoError}</Txt>}
      <Field
        label="Bio"
        value={values.bio || ""}
        onChangeText={(value) => setValue("bio", value)}
        maxLength={180}
        multiline
        placeholder="A little about your style…"
      />
      <Controller
        name="displayName"
        control={control}
        render={({ field, fieldState }) => (
          <Field
            label="Display name"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="username"
        control={control}
        render={({ field, fieldState }) => (
          <Field
            label="Username"
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            error={fieldState.error?.message}
            placeholder="3–24 lowercase letters, numbers or underscores"
          />
        )}
      />
      <ClothingPreference
        value={values.preferences.clothingMode}
        onChange={(mode) => setValue("preferences.clothingMode", mode)}
      />
      <Txt>What feels like you?</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {styles.map((style) => (
          <Chip
            key={style}
            label={style}
            selected={values.preferences.styles.includes(style)}
            onPress={() =>
              setValue(
                "preferences.styles",
                values.preferences.styles.includes(style)
                  ? values.preferences.styles.filter((s) => s !== style)
                  : [...values.preferences.styles, style],
              )
            }
          />
        ))}
      </View>
      <Row>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="preferences.size"
            render={({ field }) => (
              <Field
                label="Preferred size"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="preferences.budget"
            render={({ field, fieldState }) => (
              <Field
                label="Typical budget ($)"
                value={String(field.value)}
                onChangeText={(v) => field.onChange(Number(v) || 0)}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
      </Row>
      <Field
        label="Favorite brands (comma separated)"
        defaultValue={values.preferences.brands.join(", ")}
        onChangeText={(v) =>
          setValue(
            "preferences.brands",
            v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          )
        }
      />
      <Field
        label="Preferred colors (comma separated)"
        defaultValue={values.preferences.colors.join(", ")}
        onChangeText={(v) =>
          setValue(
            "preferences.colors",
            v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          )
        }
      />
      <Field
        label="Shopping priorities (comma separated)"
        defaultValue={values.preferences.priorities.join(", ")}
        onChangeText={(v) =>
          setValue(
            "preferences.priorities",
            v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          )
        }
      />
      <Card>
        <Txt muted style={{ fontSize: 13 }}>
          Your name and username are discoverable to signed-in users. Style and
          shopping preferences remain private. Your profile photo and bio are
          visible to signed-in users.
        </Txt>
      </Card>
      <Button
        title="Save profile"
        loading={busy}
        onPress={() => ignore(submit())}
      />
    </Screen>
  );
}
