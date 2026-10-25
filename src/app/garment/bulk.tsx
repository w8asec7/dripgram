import React, { useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp, friendlyError } from "../../state/AppProvider";
import {
  Screen,
  Txt,
  Card,
  Field,
  Button,
  Row,
  Chips,
  Chip,
  Badge,
} from "../../components/ui";
import { Garment, categories, categoryLabel } from "../../models";
import { fashionService } from "../../services/fashion";
import {
  garmentFromDescription,
  extractOffline,
} from "../../features/wardrobe/text";
import { VoiceInput } from "../../features/wardrobe/VoiceInput";
export default function BulkClothing() {
  const { voice } = useLocalSearchParams<{ voice?: string }>(),
    { data, user, services, execute } = useApp();
  const [text, setText] = useState(""),
    [garments, setGarments] = useState<Garment[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  if (!data || !user) return null;
  const service = fashionService(user, data, services.mode === "live");
  const extract = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const parsed =
        services.mode === "live"
          ? await service.extract(text)
          : extractOffline(text);
      const entries = parsed.garments.map((piece) =>
        garmentFromDescription(piece, user.id, data.profile.preferences.size),
      );
      setGarments(entries);
      setSelected(entries.map((g) => g.id));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const edit = (id: string, patch: Partial<Garment>) =>
    setGarments((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await execute(
        {
          type: "garment.bulk",
          garments: garments.filter((g) => selected.includes(g.id)),
        },
        `${selected.length} pieces added to your closet.`,
      );
      router.dismissTo("/(tabs)/closet");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      back
      title={voice ? "Say your wardrobe." : "A few words. More looks."}
      subtitle="Describe several pieces, then review each one before saving."
    >
      {!!voice && (
        <VoiceInput
          disabled={busy || services.mode !== "live"}
          transcribe={(base64) => service.transcribe(base64)}
          onText={setText}
        />
      )}
      <Badge>
        {services.mode === "live"
          ? "META · REVIEW BEFORE SAVING"
          : "OFFLINE RULE-BASED TEXT PARSER"}
      </Badge>
      <Field
        label={voice ? "Review your transcript" : "Describe your clothing"}
        value={text}
        onChangeText={setText}
        maxLength={3000}
        multiline
        placeholder="Red oversized T-shirt, blue baggy jeans, white sneakers…"
      />
      <Button
        title={garments.length ? "Extract a new list" : "Find my garments"}
        icon="layers"
        loading={busy}
        disabled={text.trim().length < 3}
        onPress={() => void extract()}
      />
      {!!error && (
        <Card>
          <Txt accessibilityRole="alert">{error}</Txt>
        </Card>
      )}
      {garments.map((g, index) => (
        <Card key={g.id}>
          <Row between>
            <Txt serif style={{ fontSize: 24 }}>
              Piece {index + 1}
            </Txt>
            <Chip
              label={selected.includes(g.id) ? "Selected ✓" : "Include piece"}
              selected={selected.includes(g.id)}
              onPress={() =>
                setSelected((ids) =>
                  ids.includes(g.id)
                    ? ids.filter((id) => id !== g.id)
                    : [...ids, g.id],
                )
              }
            />
          </Row>
          <Field
            label={`Name ${index + 1}`}
            value={g.name}
            onChangeText={(name) => edit(g.id, { name })}
          />
          <Chips
            options={categories.map(categoryLabel)}
            value={categoryLabel(g.category)}
            onChange={(label) =>
              edit(g.id, {
                category: categories.find((c) => categoryLabel(c) === label)!,
              })
            }
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label={`Color ${index + 1}`}
                value={g.primaryColor}
                onChangeText={(primaryColor) => edit(g.id, { primaryColor })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`Fit ${index + 1}`}
                value={g.fit}
                onChangeText={(fit) => edit(g.id, { fit })}
              />
            </View>
          </Row>
          <Field
            label={`Brand ${index + 1}`}
            value={g.brand || ""}
            placeholder="Only if known"
            onChangeText={(brand) => edit(g.id, { brand: brand || null })}
          />
          <Field
            label={`Description ${index + 1}`}
            value={g.description || ""}
            onChangeText={(description) => edit(g.id, { description })}
            multiline
          />
        </Card>
      ))}
      {!!garments.length && (
        <Button
          title={`Save ${selected.length} selected pieces`}
          icon="check"
          loading={busy}
          disabled={!selected.length}
          onPress={() => void save()}
        />
      )}
      <Button
        title="Add one piece manually"
        variant="ghost"
        onPress={() => router.push("/garment/photo")}
      />
    </Screen>
  );
}
