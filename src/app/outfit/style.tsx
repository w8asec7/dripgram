import { OutfitFeedbackButtons } from "../../features/outfits/OutfitFeedbackButtons";
import React, { useMemo, useState, useRef } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Badge,
  Card,
  Button,
  Section,
  DemoNote,
  Empty,
  Chips,
  ignore,
  IconButton,
} from "../../components/ui";
import { OutfitCollage } from "../../components/wardrobe";
import { useApp, friendlyError } from "../../state/AppProvider";
import { generateOutfit, OutfitResultSchema } from "../../services/ai";
import { occasionTypes } from "../../models";
import { useWeather } from "../../features/weather/useWeather";
import { WeatherSummary } from "../../components/WeatherSummary";
import { z } from "zod";
export default function StyleMe() {
  const { data, user, execute, services, busy } = useApp();
  const weatherState = useWeather();
  const [occasion, setOccasion] =
    useState<(typeof occasionTypes)[number]>("Casual day");
  const requestVersion = useRef(0);
  const requestLock = useRef(false);
  const [variation, setVariation] = useState(0);
  const [result, setResult] = useState<z.infer<
    typeof OutfitResultSchema
  > | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const stylingInput = JSON.stringify(
    data
      ? {
          ownerId: data.profile.id,
          occasionType: occasion,
          garments: data.garments.map((g) => ({ ...g, image: null })),
          preferences: data.profile.preferences,
          weather: weatherState.weather,
          variation,
        }
      : null,
  );
  // Feedback/bookmark writes must not assign a fresh ID to the displayed suggestion.
  const initial = useMemo(() => {
    const input = JSON.parse(stylingInput);
    return input ? generateOutfit(input) : null;
  }, [stylingInput]);
  const actionLock = useRef(false);
  if (!data || !user) return null;
  const recommendation = result ?? initial,
    outfit = recommendation?.outfit;
  const recommend = async () => {
    if (requestLock.current) return;
    requestLock.current = true;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const next = await services.ai.generateOutfit({
        ownerId: user.id,
        occasionType: occasion,
        garments: data.garments,
        preferences: data.profile.preferences,
        weather: weatherState.weather,
        variation: variation + 1,
        currentItems: outfit?.items,
      });
      if (version === requestVersion.current) {
        setResult(next);
        setVariation((v) => v + 1);
      }
    } catch (e) {
      if (version === requestVersion.current) setError(friendlyError(e));
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  };
  const saved = !!outfit && data.outfits.some((o) => o.id === outfit.id);
  const act = async (run: () => Promise<unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setError("");
    try {
      await run();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      actionLock.current = false;
    }
  };
  const save = () =>
    act(async () => {
      if (!outfit) return;
      await execute(
        saved
          ? { type: "outfit.delete", id: outfit.id }
          : { type: "outfit.save", outfit },
        saved ? "Removed from saved looks." : "Look saved.",
      );
    });
  const share = () =>
    act(async () => {
      if (!outfit) return;
      if (!saved) await execute({ type: "outfit.save", outfit });
      router.replace({
        pathname: "/social/post/new",
        params: { outfitId: outfit.id },
      });
    });
  return (
    <Screen back title="Style Me">
      {weatherState.weather && <WeatherSummary {...weatherState} />}
      <Section
        title="Your next look"
        action="Saved looks"
        onPress={() => router.push("/outfit/saved")}
      />
      <Chips
        options={[
          "Casual day",
          "Classes",
          "Dinner",
          "Date",
          "Party",
          "Interview",
        ]}
        value={occasion}
        onChange={(v) => {
          requestVersion.current++;
          setOccasion(v as typeof occasion);
          setVariation(0);
          setResult(null);
        }}
      />
      {outfit ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <OutfitCollage
            key={outfit.id}
            outfit={outfit}
            garments={data.garments}
            large
          />
          <View style={{ padding: 12, gap: 10 }}>
            <Badge>{outfit.occasionType.toUpperCase()}</Badge>
            <Txt serif style={{ fontSize: 24 }}>
              {outfit.name}
            </Txt>
            <Txt muted>{outfit.explanation}</Txt>
            <Row>
              {outfit.items.map((i) => {
                const g = data.garments.find((g) => g.id === i.garmentId);
                return g ? (
                  <Button
                    key={g.id}
                    title={g.name}
                    variant="ghost"
                    onPress={() => router.push(`/garment/${g.id}`)}
                  />
                ) : null;
              })}
            </Row>
            <Row style={{ gap: 4 }}>
              <IconButton
                name="bookmark"
                label={saved ? "Remove saved outfit" : "Save outfit"}
                selected={saved}
                disabled={busy || loading}
                onPress={() => ignore(save())}
              />
              <IconButton
                name="send"
                label="Share outfit"
                disabled={busy || loading}
                onPress={() => ignore(share())}
              />
              <OutfitFeedbackButtons
                outfit={outfit}
                disabled={busy || loading}
              />
            </Row>
            <DemoNote source={recommendation?.source} />
            {/limited suitable|No different suitable/i.test(
              recommendation?.message || "",
            ) && (
              <Txt accessibilityLiveRegion="polite" muted>
                {recommendation?.message}
              </Txt>
            )}
          </View>
        </Card>
      ) : (
        <Empty
          title="Start with a few favorites."
          body="Add a top and bottom to create looks from clothes you own."
          action="Add clothing"
          onPress={() => router.push("/garment/new")}
        />
      )}
      {!!error && (
        <Card>
          <Txt accessibilityRole="alert">{error}</Txt>
        </Card>
      )}
      <Button
        title={
          services.mode === "live" ? "Generate with Meta" : "Try another outfit"
        }
        icon="shuffle"
        loading={loading}
        disabled={!data.garments.length}
        onPress={() => ignore(recommend())}
      />
      {services.mode === "live" && !!result && (
        <Button
          compact
          title="Try another outfit"
          variant="ghost"
          onPress={() => ignore(recommend())}
          disabled={loading || busy}
        />
      )}
    </Screen>
  );
}
