import { assertRequiredGarment } from "../../../shared/requiredGarment";
import { chatRepository } from "../../repositories/chat";
import {
  attachmentFromGarments,
  createChatMessage,
} from "../../features/social/chatDomain";
import { useWeather } from "../../features/weather/useWeather";
import { WeatherSummary } from "../../components/WeatherSummary";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Field,
  Button,
  Chips,
  Card,
  GarmentImage,
  Empty,
  DemoNote,
  Badge,
  ignore,
} from "../../components/ui";
import { OutfitCollage } from "../../components/wardrobe";
import { useApp } from "../../state/AppProvider";
import {
  generateOutfit,
  roles,
  usable,
  categoryAllowed,
} from "../../services/ai";
import { Category, Outfit, occasionTypes } from "../../models";
export default function OutfitBuilder() {
  const weatherState = useWeather();
  const [advanced, setAdvanced] = useState(false);
  const requestVersion = useRef(0);
  const [includeAccessories, setIncludeAccessories] = useState(false);
  const [layering, setLayering] = useState<"auto" | "none" | "layered">("auto");
  const params = useLocalSearchParams<{
    requiredGarmentId?: string;
    origin?: "closet" | "feed";
    occasion?: string;
    occasionId?: string;
    variation?: string;
    planDate?: string;
    chatId?: string;
    chatKind?: "group" | "occasion";
  }>();
  const { data, user, execute, busy, services } = useApp();
  const [occasion, setOccasion] = useState(
    occasionTypes.find((t) => t === params.occasion) || "Casual day",
  );
  const [dressCode, setDressCode] = useState(
    data?.occasions.find((o) => o.id === params.occasionId)?.dressCode || "",
  );
  const [color, setColor] = useState("");
  const [style, setStyle] = useState("");
  const [variation, setVariation] = useState(Number(params.variation) || 0);
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [replacing, setReplacing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [liveResult, setLiveResult] = useState<
    | import("zod").infer<typeof import("../../services/ai").OutfitResultSchema>
    | null
  >(null);
  const [recommending, setRecommending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [notes, setNotes] = useState("");
  const [sharingChat, setSharingChat] = useState(false),
    [chatError, setChatError] = useState("");
  const shareLock = useRef(false);
  const pendingChat = useRef<ReturnType<typeof createChatMessage> | null>(null);
  const recommend = async (
    nextVariation = variation,
    replaceRole?: Outfit["items"][number]["role"],
  ) => {
    if (!data || !user || recommending) return;
    const version = ++requestVersion.current;
    setRequestError("");
    setRecommending(true);
    try {
      const response = await services.ai.generateOutfit({
        requiredGarmentId: params.requiredGarmentId,
        ownerId: user.id,
        occasionType: occasion,
        dressCode,
        garments: data.garments,
        preferences: data.profile.preferences,
        color,
        style,
        notes,
        includeAccessories,
        layering,
        weather: weatherState.weather,
        variation: nextVariation,
        replaceRole,
        currentItems: liveResult?.outfit?.items.map((item) => ({
          ...item,
          garmentId: swaps[item.role] || item.garmentId,
        })),
      });
      if (response.outfit)
        assertRequiredGarment(response.outfit.items, params.requiredGarmentId);
      if (version !== requestVersion.current) return;
      setLiveResult(response);
      setSwaps({});
    } catch (e) {
      if (version !== requestVersion.current) return;
      setRequestError(
        e instanceof Error
          ? e.message
          : "Could not recommend a look. Please retry.",
      );
    } finally {
      setRecommending(false);
    }
  };
  useEffect(() => {
    requestVersion.current++;
  }, [
    occasion,
    dressCode,
    color,
    style,
    notes,
    includeAccessories,
    layering,
    params.requiredGarmentId,
  ]);
  const result = useMemo(() => {
    try {
      return data && user
        ? services.mode === "live"
          ? liveResult
          : generateOutfit({
              requiredGarmentId: params.requiredGarmentId,
              ownerId: user.id,
              occasionType: occasion,
              dressCode,
              garments: data.garments,
              preferences: data.profile.preferences,
              color: color.trim(),
              style,
              includeAccessories,
              layering,
              weather: weatherState.weather,
              variation,
            })
        : null;
    } catch (error) {
      return {
        outfit: null,
        message:
          error instanceof Error ? error.message : "Choose another piece.",
        source: "deterministic-demo" as const,
      };
    }
  }, [
    data,
    user,
    occasion,
    dressCode,
    color,
    style,
    variation,
    liveResult,
    services.mode,
    includeAccessories,
    layering,
    weatherState.weather,
    params.requiredGarmentId,
  ]);
  if (!data || !user) return null;
  const base = result?.outfit;
  const outfit = base
    ? {
        ...base,
        name: name.trim() || base.name,
        items: base.items.map((item) => ({
          ...item,
          garmentId: swaps[item.role] || item.garmentId,
        })),
      }
    : null;
  const shareToChat = async () => {
    if (
      !outfit ||
      !data ||
      !user ||
      !params.chatId ||
      !params.chatKind ||
      shareLock.current
    )
      return;
    shareLock.current = true;
    setSharingChat(true);
    setChatError("");
    try {
      await execute({ type: "outfit.save", outfit });
      const attachment = attachmentFromGarments(
        data.garments,
        user.id,
        outfit.items.map((i) => i.garmentId),
        outfit.name,
        outfit.id,
      );
      if (
        JSON.stringify(pendingChat.current?.attachment) !==
        JSON.stringify(attachment)
      )
        pendingChat.current = createChatMessage(user.id, "", attachment);
      await chatRepository(user.mode === "demo", data).send(
        { kind: params.chatKind, id: params.chatId },
        pendingChat.current!,
      );
      router.dismissTo(
        params.chatKind === "group"
          ? `/social/group/${params.chatId}`
          : `/occasion/${params.chatId}`,
      );
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Could not share this outfit. Please retry.",
      );
    } finally {
      shareLock.current = false;
      setSharingChat(false);
    }
  };
  const save = () => {
    if (!outfit) return;
    assertRequiredGarment(outfit.items, params.requiredGarmentId);
    ignore(
      execute(
        { type: "outfit.save", outfit },
        "Look saved to your collection.",
      ).then(async () => {
        if (params.planDate) {
          await execute(
            { type: "outfit.plan", id: outfit.id, date: params.planDate },
            "Outfit planned for your week.",
          );
          router.dismissTo("/occasion/week");
          return;
        }
        router.dismissTo(
          params.origin === "closet" || params.requiredGarmentId
            ? "/(tabs)/closet"
            : "/(tabs)/feed",
        );
      }),
    );
  };
  return (
    <Screen
      back
      title={params.requiredGarmentId ? "Build a Look" : "Style Me"}
      subtitle="Built from what you own. Always yours to change."
    >
      {params.requiredGarmentId && (
        <Card>
          <Badge>BUILD AROUND THIS PIECE</Badge>
          <Row>
            <GarmentImage
              image={
                data.garments.find((g) => g.id === params.requiredGarmentId)
                  ?.image
              }
              style={{ width: 48, height: 58 }}
            />
            <Txt
              testID="required-garment-name"
              style={{ flex: 1, fontWeight: "600" }}
            >
              {data.garments.find((g) => g.id === params.requiredGarmentId)
                ?.name || "Selected piece unavailable"}
            </Txt>
            <Badge>Required</Badge>
          </Row>
        </Card>
      )}
      {weatherState.weather && <WeatherSummary {...weatherState} />}
      <Txt>What’s the occasion?</Txt>
      <Chips
        options={occasionTypes}
        value={occasion}
        onChange={(v) => {
          setOccasion(v as typeof occasion);
          setLiveResult(null);
          setSwaps({});
        }}
      />
      <Button
        compact
        title={advanced ? "Hide styling options" : "Styling options"}
        icon="sliders"
        variant="ghost"
        onPress={() => setAdvanced(!advanced)}
      />
      {advanced && (
        <>
          <Field
            label="Dress code (optional)"
            value={dressCode}
            onChangeText={(v) => {
              setDressCode(v);
              setLiveResult(null);
              setSwaps({});
            }}
            placeholder="e.g. Smart casual"
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label="Color preference"
                placeholder="Any color"
                value={color}
                onChangeText={(v) => {
                  setColor(v);
                  setLiveResult(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Style preference"
                placeholder="Any style"
                value={style}
                onChangeText={(v) => {
                  setStyle(v);
                  setLiveResult(null);
                }}
              />
            </View>
          </Row>
          <Txt>Keep it simple</Txt>
          <Chips
            options={["Core clothing", "Complete outfit"]}
            value={includeAccessories ? "Complete outfit" : "Core clothing"}
            onChange={(v) => {
              setIncludeAccessories(v === "Complete outfit");
              setLiveResult(null);
            }}
          />
          <Chips
            options={["auto", "none", "layered"]}
            value={layering}
            onChange={(v) => {
              setLayering(v as typeof layering);
              setLiveResult(null);
            }}
          />
          <Field
            label="Additional preferences"
            value={notes}
            onChangeText={(v) => {
              setNotes(v);
              setLiveResult(null);
            }}
            placeholder="e.g. Comfortable shoes for a long evening"
          />
        </>
      )}
      {services.mode === "live" && (
        <Button
          title="Generate with Meta"
          icon="layers"
          loading={recommending}
          onPress={() => ignore(recommend())}
        />
      )}
      {!!requestError && (
        <Card>
          <Txt>{requestError}</Txt>
          <Button
            title="Retry recommendation"
            onPress={() => ignore(recommend())}
          />
        </Card>
      )}
      {outfit ? (
        <>
          <OutfitCollage outfit={outfit} garments={data.garments} large />
          <Row between>
            <Badge>{occasion.toUpperCase()}</Badge>
            <Button
              title="Try another"
              icon="shuffle"
              variant="ghost"
              onPress={() => {
                setVariation(variation + 1);
                if (services.mode === "live") ignore(recommend(variation + 1));
                setSwaps({});
                setReplacing(null);
              }}
            />
          </Row>
          <Txt muted>{outfit.explanation}</Txt>
          <Field
            label="Name your look"
            value={name}
            onChangeText={setName}
            placeholder={outfit.name}
          />
          {outfit.items.map((item) => {
            const g = data.garments.find((g) => g.id === item.garmentId)!;
            const choices = data.garments.filter(
              (g) =>
                usable(g) &&
                categoryAllowed(g.category, occasion, dressCode) &&
                (roles[item.role] as readonly Category[]).includes(
                  g.category,
                ) &&
                g.id !== item.garmentId &&
                !outfit.items.some((i) => i.garmentId === g.id),
            );
            return (
              <Card key={item.role}>
                <Row>
                  <GarmentImage
                    image={g.image}
                    style={{ width: 60, height: 68 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt
                      muted
                      style={{ fontSize: 11, textTransform: "uppercase" }}
                    >
                      {item.role}
                    </Txt>
                    <Txt style={{ fontWeight: "500" }}>{g.name}</Txt>
                  </View>
                  {g.id === params.requiredGarmentId ? (
                    <Badge>Required</Badge>
                  ) : (
                    <Button
                      title={replacing === item.role ? "Close" : "Replace"}
                      variant="ghost"
                      onPress={() =>
                        setReplacing(replacing === item.role ? null : item.role)
                      }
                    />
                  )}
                </Row>
                {replacing === item.role && (
                  <View style={{ gap: 10 }}>
                    {services.mode === "live" && choices.length > 0 && (
                      <Button
                        title="Ask Meta to replace this piece"
                        loading={recommending}
                        variant="secondary"
                        onPress={() =>
                          ignore(recommend(variation + 1, item.role))
                        }
                      />
                    )}
                    {choices.length ? (
                      choices.map((candidate) => (
                        <Card
                          key={candidate.id}
                          onPress={() => {
                            setSwaps({ ...swaps, [item.role]: candidate.id });
                            setReplacing(null);
                          }}
                        >
                          <Row>
                            <GarmentImage
                              image={candidate.image}
                              style={{ width: 44, height: 50 }}
                            />
                            <Txt style={{ flex: 1 }}>{candidate.name}</Txt>
                            <Badge>Choose</Badge>
                          </Row>
                        </Card>
                      ))
                    ) : (
                      <Txt muted>
                        No other {item.role} fits this dress code.
                      </Txt>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
          <DemoNote source={result?.source} />
          {/limited suitable|No different suitable/i.test(
            result?.message || "",
          ) && (
            <Txt muted accessibilityLiveRegion="polite">
              {result?.message}
            </Txt>
          )}
          {!params.chatId && (
            <>
              <Button
                title="Save this look"
                icon="bookmark"
                loading={busy}
                onPress={() => save()}
              />
            </>
          )}
          {!!chatError && <Txt accessibilityRole="alert">{chatError}</Txt>}
          {!!params.chatId && !!params.chatKind && (
            <Button
              title="Share outfit in chat"
              icon="send"
              loading={sharingChat || busy}
              onPress={() => void shareToChat()}
            />
          )}
          {!!params.occasionId && (
            <Button
              title="Save & share to occasion"
              variant="secondary"
              onPress={() =>
                ignore(
                  execute({ type: "outfit.save", outfit })
                    .then(() =>
                      execute(
                        {
                          type: "occasion.share",
                          id: params.occasionId!,
                          outfitId: outfit.id,
                        },
                        "Only this outfit snapshot was shared.",
                      ),
                    )
                    .then(() =>
                      router.dismissTo(`/occasion/${params.occasionId}`),
                    ),
                )
              }
            />
          )}
        </>
      ) : (
        <Empty
          title="Let’s work with what you have."
          body={
            result?.message ||
            "Choose your occasion, then request a recommendation using your clothes."
          }
          action="Open closet"
          onPress={() => router.dismissTo("/(tabs)/closet")}
        />
      )}
    </Screen>
  );
}
