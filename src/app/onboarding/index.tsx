import { ClothingPreference } from "../../components/ClothingPreference";
import React, { useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Button,
  Chip,
  Field,
  Card,
  Icon,
  Badge,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { styles } from "../../models";
import { theme as t } from "../../theme";
export default function Onboarding() {
  const { data, user, execute, busy } = useApp();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState(data?.profile.preferences);
  if (!user) return <Redirect href="/" />;
  if (!data || !preferences) return null;
  const persist = () =>
    execute({ type: "profile", profile: { ...data.profile, preferences } });
  const next = () => ignore(persist().then(() => setStep(step + 1)));
  const finish = () =>
    ignore(
      execute({
        type: "profile",
        profile: { ...data.profile, preferences, onboardingComplete: true },
      }).then(() => router.replace("/(tabs)/feed")),
    );
  return (
    <Screen>
      <Row between style={{ paddingTop: 20 }}>
        <Txt serif style={{ fontSize: 32 }}>
          DripGram
        </Txt>
        <Badge>{step + 1} OF 4 · OPTIONAL SETUP</Badge>
      </Row>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 3,
              backgroundColor: i <= step ? t.colors.sage : t.colors.border,
            }}
          />
        ))}
      </View>
      {step === 0 ? (
        <>
          <Txt serif style={{ fontSize: 40, lineHeight: 45 }}>
            Style is personal.{`\n`}Let’s start with yours.
          </Txt>
          <ClothingPreference
            value={preferences.clothingMode}
            onChange={(clothingMode) =>
              setPreferences({ ...preferences, clothingMode })
            }
          />
          <Txt muted>Choose what feels like you. There’s no wrong mix.</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {styles.map((style) => (
              <Chip
                key={style}
                label={style}
                selected={preferences.styles.includes(style)}
                onPress={() =>
                  setPreferences({
                    ...preferences,
                    styles: preferences.styles.includes(style)
                      ? preferences.styles.filter((x) => x !== style)
                      : [...preferences.styles, style],
                  })
                }
              />
            ))}
          </View>
        </>
      ) : step === 1 ? (
        <>
          <Txt serif style={{ fontSize: 40 }}>
            A few preferences.
          </Txt>
          <Txt muted>Entirely optional. You can change these anytime.</Txt>
          <Field
            label="Preferred size"
            value={preferences.size}
            onChangeText={(size) => setPreferences({ ...preferences, size })}
          />
          <Field
            label="Typical budget (USD)"
            keyboardType="numeric"
            value={String(preferences.budget)}
            onChangeText={(v) =>
              setPreferences({
                ...preferences,
                budget: Math.max(0, Number(v) || 0),
              })
            }
          />
          <Field
            label="Favorite brands (comma separated)"
            defaultValue={preferences.brands.join(", ")}
            onChangeText={(v) =>
              setPreferences({
                ...preferences,
                brands: v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
          <Field
            label="Favorite colors (comma separated)"
            defaultValue={preferences.colors.join(", ")}
            onChangeText={(v) =>
              setPreferences({
                ...preferences,
                colors: v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
          <Field
            label="Shopping priorities (comma separated)"
            defaultValue={preferences.priorities.join(", ")}
            onChangeText={(v) =>
              setPreferences({
                ...preferences,
                priorities: v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </>
      ) : step === 2 ? (
        <>
          <Txt serif style={{ fontSize: 40 }}>
            Start with one favorite.
          </Txt>
          <Txt muted>
            You don’t need to photograph your whole closet. Add a piece now, or
            explore at your own pace.
          </Txt>
          <Card>
            <Icon name="camera" size={32} color={t.colors.sage} />
            <Txt serif style={{ fontSize: 26 }}>
              A little wardrobe magic.
            </Txt>
            <Button
              title="Take a photo"
              variant="secondary"
              icon="camera"
              onPress={() =>
                router.push({
                  pathname: "/garment/new",
                  params: { source: "camera" },
                })
              }
            />
            <Button
              title="Upload from library"
              variant="secondary"
              icon="image"
              onPress={() =>
                router.push({
                  pathname: "/garment/new",
                  params: { source: "library" },
                })
              }
            />
            <Button
              title="Add manually"
              variant="ghost"
              onPress={() => router.push("/garment/new")}
            />
          </Card>
          {user.mode === "demo" && (
            <Txt muted>
              Your demo wardrobe already has 18 pieces to explore.
            </Txt>
          )}
        </>
      ) : (
        <>
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 20 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: t.colors.sageLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={36} color={t.colors.sage} />
            </View>
            <Txt serif style={{ fontSize: 40, textAlign: "center" }}>
              A little more you.
            </Txt>
            <Txt muted style={{ textAlign: "center" }}>
              Your wardrobe, considered.{`\n`}
              {preferences.styles.join(" · ") ||
                "Your style is yours to define."}
            </Txt>
          </View>
          <Card>
            <Txt>{data.garments.length} pieces in your wardrobe</Txt>
            <Txt muted>Private by default. Share only what you choose.</Txt>
          </Card>
        </>
      )}
      <View style={{ gap: 8, marginTop: 12 }}>
        <Button
          title={step === 3 ? "Meet your wardrobe" : "Continue"}
          loading={busy}
          icon="arrow-right"
          onPress={step === 3 ? finish : next}
        />
        {step < 3 && (
          <Button
            title={
              step === 2 ? "Explore without adding clothes" : "Skip for now"
            }
            variant="ghost"
            onPress={step === 2 ? () => setStep(3) : () => setStep(step + 1)}
          />
        )}
      </View>
    </Screen>
  );
}
