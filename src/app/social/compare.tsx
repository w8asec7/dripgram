import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, Txt, Empty } from "../../components/ui";
import { LookCard } from "../../features/social/LookCard";
import { useApp } from "../../state/AppProvider";
import { canReadLook } from "../../repositories/domain";
export default function CompareLooks() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { data, user } = useApp();
  const looks =
    data?.looks
      .filter(
        (l) =>
          ids?.split(",").includes(l.id) &&
          canReadLook(data, user?.id || "", l.id),
      )
      .slice(0, 2) || [];
  return (
    <Screen back title="Which combination?">
      <Txt muted>
        Compare the pieces, then leave your opinion in the discussion.
      </Txt>
      {looks.map((l) => (
        <LookCard key={l.id} look={l} />
      ))}
      {looks.length < 2 && (
        <Empty
          title="Two shared looks needed."
          body="Return to a discussion and suggest another combination."
        />
      )}
    </Screen>
  );
}
