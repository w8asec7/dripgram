import React, { useState } from "react";
import { FlatList, Modal, Pressable } from "react-native";
import { AppData, categoryGroup, primaryCategories } from "../../models";
import { ChatAttachment } from "../../models/chat";
import {
  Screen,
  Txt,
  Card,
  Button,
  IconButton,
  GarmentImage,
  Empty,
  Badge,
  Chips,
} from "../../components/ui";
import { attachmentFromGarments } from "./chatDomain";
import { theme as t } from "../../theme";
export function ChatAttachmentPicker({
  mode,
  data,
  userId,
  onClose,
  onAttach,
  onError,
}: {
  mode: "closet" | "saved";
  data: AppData;
  userId: string;
  onClose: () => void;
  onAttach: (attachment: ChatAttachment) => void;
  onError: (error: unknown) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [category, setCategory] = useState("All");
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => onClose()}
    >
      <Screen
        scroll={false}
        title={mode === "saved" ? "Share a saved look." : "Choose your pieces."}
        action={
          <IconButton
            name="x"
            label="Close outfit picker"
            onPress={() => onClose()}
          />
        }
      >
        {mode === "closet" ? (
          <>
            <Chips
              options={["All", ...primaryCategories, "Accessories"]}
              value={category}
              onChange={setCategory}
            />
            <Txt muted>
              {selected.length}/8 selected · sharing does not record a wear
            </Txt>
            <FlatList
              data={data.garments.filter((g) =>
                category === "Accessories"
                  ? g.category === "accessories"
                  : category === "All"
                    ? !!categoryGroup(g.category)
                    : categoryGroup(g.category) === category,
              )}
              keyExtractor={(g) => g.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
              renderItem={({ item: g }) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={g.name}
                  accessibilityState={{ checked: selected.includes(g.id) }}
                  onPress={() =>
                    setSelected((ids) =>
                      ids.includes(g.id)
                        ? ids.filter((id) => id !== g.id)
                        : ids.length < 8
                          ? [...ids, g.id]
                          : ids,
                    )
                  }
                  style={{
                    flex: 1,
                    maxWidth: "49%",
                    padding: 8,
                    gap: 6,
                    borderRadius: t.radius.md,
                    borderWidth: 2,
                    borderColor: selected.includes(g.id)
                      ? t.colors.sage
                      : t.colors.border,
                  }}
                >
                  <GarmentImage
                    image={g.image}
                    label={g.name}
                    style={{ height: 145 }}
                  />
                  <Txt numberOfLines={2} style={{ fontSize: 13 }}>
                    {g.name}
                  </Txt>
                  {selected.includes(g.id) && <Badge>Selected ✓</Badge>}
                </Pressable>
              )}
              ListEmptyComponent={
                <Empty
                  title="No pieces here yet."
                  body="Add clothing to your closet first."
                />
              }
            />
            <Button
              title={`Attach ${selected.length} ${selected.length === 1 ? "piece" : "pieces"}`}
              disabled={!selected.length}
              onPress={() => {
                onAttach(
                  attachmentFromGarments(
                    data.garments,
                    userId,
                    selected,
                    "My outfit idea",
                  ),
                );
                onClose();
                setSelected([]);
              }}
            />
          </>
        ) : (
          <FlatList
            data={data.outfits}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item: o }) => (
              <Card
                onPress={() => {
                  try {
                    onAttach(
                      attachmentFromGarments(
                        data.garments,
                        userId,
                        o.items.map((i) => i.garmentId),
                        o.name,
                        o.id,
                      ),
                    );
                    onClose();
                  } catch (e) {
                    onError(e);
                    onClose();
                  }
                }}
              >
                <Txt style={{ fontWeight: "600" }}>{o.name}</Txt>
                <Txt muted>
                  {o.items.length} pieces · {o.occasionType}
                </Txt>
              </Card>
            )}
            ListEmptyComponent={
              <Empty
                title="Save your first look."
                body="Create an AI outfit or choose individual pieces from your closet."
              />
            }
          />
        )}
      </Screen>
    </Modal>
  );
}
