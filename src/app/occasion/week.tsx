import React, { useState } from "react";
import { router } from "expo-router";
import { Screen, Card, Txt, Badge, Button, ignore } from "../../components/ui";
import { OutfitCollage, OccasionCard } from "../../components/wardrobe";
import { useApp } from "../../state/AppProvider";
import { dateOffset, makeId, isoNow } from "../../models";
export default function Week() {
  const { data, execute, busy } = useApp();
  const [choosing, setChoosing] = useState<string | null>(null);
  if (!data) return null;
  return (
    <Screen
      back
      title="Your week, well dressed."
      subtitle="Seven days of plans and pieces. Your calendar stays private."
    >
      <Button
        title="Add an occasion"
        icon="plus"
        variant="secondary"
        onPress={() => router.push("/occasion/new")}
      />
      {Array.from({ length: 7 }, (_, i) => dateOffset(i)).map((date) => {
        const planned = data.outfits.find((o) => o.plannedFor === date);
        const events = data.occasions.filter((o) => o.date === date);
        return (
          <Card key={date}>
            <Badge>
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Badge>
            {events.map((o) => (
              <OccasionCard key={o.id} occasion={o} />
            ))}
            {!events.length && <Txt muted>A day of your own</Txt>}
            {planned ? (
              <>
                <OutfitCollage outfit={planned} garments={data.garments} />
                <Button
                  title={planned.name}
                  variant="ghost"
                  onPress={() => router.push(`/outfit/${planned.id}`)}
                />
              </>
            ) : (
              <Txt>No outfit planned yet.</Txt>
            )}
            <Button
              title={
                choosing === date
                  ? "Close looks"
                  : planned
                    ? "Change planned outfit"
                    : "Choose an outfit"
              }
              variant="secondary"
              onPress={() => setChoosing(choosing === date ? null : date)}
            />
            {choosing === date && (
              <>
                {data.outfits
                  .filter((o) => !o.plannedFor || o.plannedFor === date)
                  .map((o) => (
                    <Button
                      key={o.id}
                      title={o.name}
                      variant="secondary"
                      loading={busy}
                      onPress={() =>
                        ignore(
                          execute(
                            { type: "outfit.plan", id: o.id, date },
                            "Outfit planned.",
                          ).then(() => setChoosing(null)),
                        )
                      }
                    />
                  ))}
                {data.outfits
                  .filter((o) => o.plannedFor && o.plannedFor !== date)
                  .map((o) => (
                    <Button
                      key={o.id}
                      title={`Repeat ${o.name}`}
                      loading={busy}
                      variant="ghost"
                      onPress={() =>
                        ignore(
                          (async () => {
                            const copy = {
                              ...o,
                              id: makeId("outfit"),
                              plannedFor: null,
                              confirmedAt: null,
                              createdAt: isoNow(),
                            };
                            await execute({
                              type: "outfit.save",
                              outfit: copy,
                            });
                            await execute(
                              { type: "outfit.plan", id: copy.id, date },
                              "Another day, a favorite look.",
                            );
                            setChoosing(null);
                          })(),
                        )
                      }
                    />
                  ))}
                <Button
                  title="Build a new look"
                  onPress={() =>
                    router.push({
                      pathname: "/outfit/build",
                      params: {
                        occasion: events[0]?.type || "Casual day",
                        planDate: date,
                      },
                    })
                  }
                />
              </>
            )}
          </Card>
        );
      })}
      <Txt muted>
        External calendar connection is optional and not connected in this
        release. Manually added occasions stay available; no calendar details
        are shared automatically.
      </Txt>
    </Screen>
  );
}
