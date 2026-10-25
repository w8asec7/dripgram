import React, { useState, useRef } from "react";
import { View } from "react-native";
import {
  Screen,
  Txt,
  Button,
  Row,
  Field,
  Badge,
  Empty,
  confirmAction,
  ignore,
} from "../../components/ui";
import { GarmentCard } from "../../components/wardrobe";
import { useApp, friendlyError } from "../../state/AppProvider";
import { useWardrobeActions } from "../../features/wardrobe/useWardrobeActions";
export default function ManageClothes() {
  const { data, busy } = useApp();
  const actions = useWardrobeActions();
  const [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  if (!data) return null;
  const garments = data.garments.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase()),
  );
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      await action();
      setSelected([]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      lock.current = false;
      setWorking(false);
    }
  };
  return (
    <Screen
      back
      title="Manage your clothes."
      subtitle="Select pieces to remove from your closet."
    >
      <Field
        label="Find clothes to manage"
        value={query}
        onChangeText={setQuery}
      />
      <Row between>
        <Badge>{selected.length} SELECTED</Badge>
        <Button
          title="Select visible clothes"
          variant="ghost"
          disabled={busy || working}
          onPress={() => setSelected(garments.map((g) => g.id))}
        />
        <Button
          title="Clear selection"
          variant="ghost"
          disabled={!selected.length || working}
          onPress={() => setSelected([])}
        />
      </Row>
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      <Row style={{ alignItems: "stretch" }}>
        <Button
          title="Delete selected"
          icon="trash-2"
          variant="danger"
          style={{ flex: 1 }}
          loading={working || busy}
          disabled={!selected.length}
          onPress={() =>
            confirmAction(
              `Delete ${selected.length} garment${selected.length === 1 ? "" : "s"}?`,
              "These clothes and their private thumbnails will be removed. Your wear history stays saved.",
              () => ignore(run(() => actions.deleteGarments(selected))),
            )
          }
        />
      </Row>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 20,
        }}
      >
        {garments.map((g) => (
          <GarmentCard
            key={g.id}
            garment={g}
            selected={selected.includes(g.id)}
            onPress={() =>
              setSelected(
                selected.includes(g.id)
                  ? selected.filter((id) => id !== g.id)
                  : [...selected, g.id],
              )
            }
          />
        ))}
      </View>
      {!garments.length && (
        <Empty
          title="No clothes to manage."
          body="Try another search or add a piece from Closet."
        />
      )}
    </Screen>
  );
}
