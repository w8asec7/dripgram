import React, { useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Field,
  Txt,
  Chips,
  Button,
  Card,
  Row,
  Chip,
  GarmentImage,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { isFriend } from "../../repositories/domain";
import { makeId } from "../../models";
export default function Share() {
  const params = useLocalSearchParams<{
    groupId?: string;
    outfitId?: string;
    parentId?: string;
    garmentId?: string;
  }>();
  const { data, user, execute, busy } = useApp();
  const [title, setTitle] = useState(""),
    [outfitId, setOutfitId] = useState(params.outfitId || ""),
    [garmentId, setGarmentId] = useState(params.garmentId || ""),
    [groupId, setGroupId] = useState(params.groupId || ""),
    [friends, setFriends] = useState<string[]>([]),
    [error, setError] = useState("");
  const [id] = useState(() => makeId("look"));
  const lock = useRef(false);
  if (!data || !user) return null;
  const parent = data.looks.find((l) => l.id === params.parentId);
  const outfit = data.outfits.find((o) => o.id === outfitId);
  const ids = garmentId
    ? [garmentId]
    : outfit?.items.map((i) => i.garmentId) || [];
  const group = data.groups.find((g) => g.id === groupId);
  return (
    <Screen
      back
      title={
        parent ? "Suggest another combination." : "Share your point of view."
      }
      subtitle="Only the pieces and audience you choose are shared."
    >
      <Field
        label="Discussion title"
        value={title}
        onChangeText={setTitle}
        placeholder={
          parent ? "What about this combination?" : "Friday Dinner Fits"
        }
        error={error}
      />
      <Txt>Pick a saved outfit</Txt>
      <Chips
        options={data.outfits.map((o) => o.name)}
        value={outfit?.name || ""}
        onChange={(name) => {
          setOutfitId(data.outfits.find((o) => o.name === name)?.id || "");
          setGarmentId("");
        }}
      />
      <Txt>Or share one garment</Txt>
      <Chips
        options={data.garments.map((g) => g.name)}
        value={data.garments.find((g) => g.id === garmentId)?.name || ""}
        onChange={(name) => {
          setGarmentId(data.garments.find((g) => g.name === name)?.id || "");
          setOutfitId("");
        }}
      />
      <Row>
        {ids.map((id) => {
          const g = data.garments.find((g) => g.id === id);
          return g ? (
            <GarmentImage
              key={id}
              image={g.image}
              label={g.name}
              style={{ height: 140, flex: 1 }}
            />
          ) : null;
        })}
      </Row>
      {parent ? (
        <Card>
          <Txt>Replying to {parent.title}</Txt>
          <Txt muted>Same selected audience as this discussion.</Txt>
        </Card>
      ) : (
        <>
          <Txt>Share with a group</Txt>
          <Chips
            options={["Selected friends", ...data.groups.map((g) => g.name)]}
            value={group?.name || "Selected friends"}
            onChange={(name) => {
              setGroupId(data.groups.find((g) => g.name === name)?.id || "");
              setFriends([]);
            }}
          />
          {!groupId && (
            <Row>
              {data.directory
                .filter((p) => isFriend(data, user.id, p.id))
                .map((p) => (
                  <Chip
                    key={p.id}
                    label={p.displayName}
                    selected={friends.includes(p.id)}
                    onPress={() =>
                      setFriends(
                        friends.includes(p.id)
                          ? friends.filter((id) => id !== p.id)
                          : friends.length < 7
                            ? [...friends, p.id]
                            : friends,
                      )
                    }
                  />
                ))}
            </Row>
          )}
        </>
      )}
      <Card>
        <Txt style={{ fontWeight: "600" }}>Audience</Txt>
        <Txt muted>
          {(parent?.audienceIds || group?.memberIds || [user.id, ...friends])
            .map(
              (id) =>
                data.directory.find((p) => p.id === id)?.displayName || "You",
            )
            .join(", ")}
        </Txt>
        <Txt muted>Your full closet stays private.</Txt>
      </Card>
      <Button
        title="Share selected look"
        icon="send"
        loading={busy}
        disabled={!ids.length || (!parent && !group && !friends.length)}
        onPress={() =>
          ignore(
            (async () => {
              if (lock.current) return;
              lock.current = true;
              setError("");
              try {
                await execute(
                  {
                    type: "look.share",
                    id,
                    title:
                      title.trim() ||
                      outfit?.name ||
                      "A piece for your thoughts",
                    outfitId: outfit?.id || null,
                    garmentIds: ids,
                    groupId: parent?.groupId || groupId || null,
                    friendIds: friends,
                    parentId: parent?.id,
                  },
                  "Shared only with your selected audience.",
                );
                router.replace(`/social/look/${parent?.id || id}`);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not share this look.",
                );
              } finally {
                lock.current = false;
              }
            })(),
          )
        }
      />
    </Screen>
  );
}
