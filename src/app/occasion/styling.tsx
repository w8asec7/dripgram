import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import {
  Screen,
  Txt,
  Row,
  Badge,
  Card,
  Button,
  Field,
  GarmentImage,
  Section,
  Avatar,
  DemoNote,
  Empty,
  confirmAction,
  ignore,
} from "../../components/ui";
import { GroupResultSchema } from "../../services/ai";
import { useApp, friendlyError } from "../../state/AppProvider";
import { theme as t } from "../../theme";
export default function OccasionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, user, execute, services, busy } = useApp();
  const occasion = data?.occasions.find((o) => o.id === id);
  const [sharing, setSharing] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState("");
  const [styling, setStyling] = useState<z.infer<
    typeof GroupResultSchema
  > | null>(null);
  const [error, setError] = useState("");
  const [coordinating, setCoordinating] = useState(false);
  const coordinate = async () => {
    if (!occasion) return;
    setError("");
    setCoordinating(true);
    try {
      setStyling(
        await services.ai.coordinateGroup({
          occasionId: occasion.id,
          dressCode: occasion.dressCode,
          theme: occasion.theme,
          participants: occasion.participantIds.length,
        }),
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setCoordinating(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (occasion && services.mode === "demo")
      services.ai
        .coordinateGroup({
          occasionId: occasion.id,
          dressCode: occasion.dressCode,
          theme: occasion.theme,
          participants: occasion.participantIds.length,
        })
        .then((s) => {
          if (active) setStyling(s);
        })
        .catch((e) => {
          if (active) setError(friendlyError(e));
        });
    return () => {
      active = false;
    };
  }, [occasion, services]);
  if (!data || !user || !occasion)
    return (
      <Screen back>
        <Empty
          title="A private occasion."
          body="This occasion is unavailable or you haven’t been invited."
        />
      </Screen>
    );
  const invited =
    occasion.participants.find((p) => p.userId === user.id)?.status ===
    "invited";
  return (
    <Screen back>
      <Badge>{occasion.type.toUpperCase()} · SHARED OCCASION</Badge>
      <Txt serif style={{ fontSize: 38, lineHeight: 43 }}>
        {occasion.name}
      </Txt>
      <Txt muted>
        {new Date(`${occasion.date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}{" "}
        · {occasion.time}
      </Txt>
      <Card>
        <Txt style={{ fontWeight: "600" }}>
          {occasion.dressCode || "Dress as yourself"}
        </Txt>
        <Txt muted>
          {occasion.description || "Good company is the dress code."}
        </Txt>
        <Row>
          {occasion.participants.map((p) => {
            const person = data.directory.find((d) => d.id === p.userId);
            return (
              <View key={p.userId} style={{ alignItems: "center", gap: 4 }}>
                <Avatar name={person?.displayName || "Friend"} size={36} />
                <Txt muted style={{ fontSize: 10 }}>
                  {person?.displayName.split(" ")[0]} · {p.status}
                </Txt>
              </View>
            );
          })}
        </Row>
        {invited && (
          <Button
            title="Accept invitation"
            variant="secondary"
            onPress={() =>
              ignore(
                execute(
                  { type: "occasion.join", id: occasion.id },
                  "You’re in. Make it your kind of occasion.",
                ),
              )
            }
          />
        )}
      </Card>
      <Card
        style={{
          backgroundColor: t.colors.sageLight,
          borderColor: t.colors.sageLight,
        }}
      >
        <Badge>
          {user.mode === "demo"
            ? "SAMPLE GROUP STYLING"
            : "GROUP STYLING · SHARED SNAPSHOTS ONLY"}
        </Badge>
        <Txt serif style={{ fontSize: 28 }}>
          In good coordination.
        </Txt>
        {user.mode === "firebase" && (
          <Button
            title="Coordinate with Meta"
            loading={coordinating}
            variant="secondary"
            onPress={() => ignore(coordinate())}
          />
        )}
        {styling && (
          <>
            <Row>
              {styling.palette.map((c) => (
                <View
                  key={c}
                  accessibilityLabel={`Palette color ${c}`}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: c,
                    borderWidth: 1,
                    borderColor: t.colors.surface,
                  }}
                />
              ))}
            </Row>
            <Txt>{styling.dressCode}</Txt>
            <Txt muted>{styling.coordination}</Txt>
            {styling.recommendations.map((tip) => (
              <Txt key={tip} muted style={{ fontSize: 13 }}>
                • {tip}
              </Txt>
            ))}
          </>
        )}
        <DemoNote source={styling?.source} />
        {!!error && <Txt style={{ color: t.colors.error }}>{error}</Txt>}
        <Button
          title="Build my occasion look"
          icon="layers"
          onPress={() =>
            router.push({
              pathname: "/outfit/build",
              params: { occasion: occasion.type, occasionId: occasion.id },
            })
          }
        />
      </Card>
      <Section title="The group mood" />
      <Txt serif style={{ fontSize: 26 }}>
        {occasion.theme || "A theme is yours to suggest."}
      </Txt>
      <Field
        label="Suggest a group theme"
        value={theme}
        onChangeText={setTheme}
        placeholder="e.g. A little olive, a lot of personality"
        maxLength={100}
      />
      <Button
        title="Suggest theme"
        variant="secondary"
        disabled={!theme.trim()}
        onPress={() =>
          ignore(
            execute(
              { type: "occasion.theme", id: occasion.id, theme },
              "Group theme updated.",
            ).then(() => setTheme("")),
          )
        }
      />
      <Section title="Looks from your people" />
      <Button
        title={sharing ? "Close saved looks" : "Share a saved outfit"}
        icon="share-2"
        variant="secondary"
        onPress={() => setSharing(!sharing)}
      />
      {sharing && (
        <Card>
          <Txt muted style={{ fontSize: 12 }}>
            Only this outfit’s name and garment snapshots are shared with
            participants. Your wardrobe stays private.
          </Txt>
          {data.outfits.map((o) => (
            <Button
              key={o.id}
              title={o.name}
              variant="ghost"
              loading={busy}
              onPress={() =>
                ignore(
                  execute(
                    { type: "occasion.share", id: occasion.id, outfitId: o.id },
                    "Outfit snapshot shared with this occasion.",
                  ).then(() => setSharing(false)),
                )
              }
            />
          ))}
          {!data.outfits.length && (
            <Button
              title="Create a look first"
              onPress={() => router.push("/outfit/build")}
            />
          )}
        </Card>
      )}
      {occasion.submissions.map((s) => {
        const author = data.directory.find((p) => p.id === s.ownerId);
        return (
          <Card key={s.id}>
            <Row>
              <Avatar name={author?.displayName || "Friend"} size={36} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: "600" }}>
                  {author?.displayName || "Friend"}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {s.outfitName}
                </Txt>
              </View>
            </Row>
            <Row style={{ gap: 8 }}>
              {s.pieces.map((p) => (
                <View key={p.id} style={{ flex: 1, minWidth: 65, gap: 5 }}>
                  <GarmentImage
                    image={p.image}
                    occasionId={occasion.id}
                    label={p.name}
                    style={{ height: 125 }}
                  />
                  <Txt
                    numberOfLines={2}
                    muted
                    style={{ fontSize: 10, lineHeight: 15 }}
                  >
                    {p.name}
                  </Txt>
                </View>
              ))}
            </Row>
            <Row>
              <Button
                title={`${s.votes.includes(user.id) ? "Voted" : "Vote"} · ${s.votes.length}`}
                icon="heart"
                variant={s.votes.includes(user.id) ? "primary" : "secondary"}
                onPress={() =>
                  ignore(
                    execute({
                      type: "occasion.vote",
                      id: occasion.id,
                      submissionId: s.id,
                    }),
                  )
                }
              />
              <Badge>INTENTIONALLY SHARED</Badge>
            </Row>
            {s.comments.map((c) => (
              <View
                key={c.id}
                style={{
                  padding: 10,
                  backgroundColor: t.colors.background,
                  borderRadius: 10,
                }}
              >
                <Txt style={{ fontSize: 12, fontWeight: "600" }}>
                  {data.directory
                    .find((p) => p.id === c.authorId)
                    ?.displayName.split(" ")[0] || "Friend"}
                </Txt>
                <Txt style={{ fontSize: 13 }}>{c.text}</Txt>
              </View>
            ))}
            <Field
              label={`Comment on ${author?.displayName.split(" ")[0] || "shared"}’s look`}
              value={comments[s.id] || ""}
              onChangeText={(v) => setComments({ ...comments, [s.id]: v })}
              maxLength={180}
              placeholder="A little encouragement goes a long way"
            />
            <Button
              title="Post comment"
              variant="ghost"
              disabled={!comments[s.id]?.trim()}
              onPress={() =>
                ignore(
                  execute(
                    {
                      type: "occasion.comment",
                      id: occasion.id,
                      submissionId: s.id,
                      text: comments[s.id],
                    },
                    "Comment added.",
                  ).then(() => setComments({ ...comments, [s.id]: "" })),
                )
              }
            />
          </Card>
        );
      })}
      {!occasion.submissions.length && (
        <Empty
          title="Be the first to set the mood."
          body="Share a saved look or build one for the occasion."
        />
      )}
      {occasion.ownerId === user.id && (
        <Row>
          <Button
            title="Edit occasion"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/occasion/edit",
                params: { id: occasion.id },
              })
            }
          />
          <Button
            title="Delete occasion"
            variant="ghost"
            onPress={() =>
              confirmAction(
                "Delete this occasion?",
                "Participants will lose access to this shared occasion.",
                () =>
                  ignore(
                    execute(
                      { type: "occasion.delete", id: occasion.id },
                      "Occasion removed.",
                    ).then(() => router.replace("/(tabs)/feed")),
                  ),
              )
            }
          />
        </Row>
      )}
    </Screen>
  );
}
