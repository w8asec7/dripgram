import React, { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Card,
  Badge,
  Button,
  DemoNote,
  ignore,
} from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { wardrobeInsights } from "../../services/ai";
export default function Insights() {
  const { data, user, services } = useApp();
  const [insights, setInsights] = useState<ReturnType<
    typeof wardrobeInsights
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!data) return null;
  return (
    <Screen
      back
      title="More from less."
      subtitle="Your wardrobe has more possibilities than you think."
    >
      <DemoNote source={insights ? "meta" : "deterministic-demo"} />
      {user?.mode === "firebase" && (
        <Button
          title="Analyze my wardrobe with Meta"
          loading={loading}
          onPress={() => {
            setLoading(true);
            ignore(
              services.ai
                .analyzeWardrobe(data.garments)
                .then(setInsights)
                .catch((e) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not analyze your wardrobe. Retry shortly.",
                  ),
                )
                .finally(() => setLoading(false)),
            );
          }}
        />
      )}
      {!!error && (
        <Card>
          <Txt>{error}</Txt>
        </Card>
      )}
      {(insights || wardrobeInsights(data.garments)).map((insight) => (
        <Card key={insight.id}>
          <Badge>
            {insight.kind === "gap"
              ? "A THOUGHTFUL ADDITION"
              : "START WITH WHAT YOU OWN"}
          </Badge>
          <Txt serif style={{ fontSize: 28 }}>
            {insight.title}
          </Txt>
          <Txt muted>{insight.explanation}</Txt>
          <Button
            title={
              insight.kind === "gap"
                ? "Explore this addition"
                : "Style what I own"
            }
            variant="secondary"
            onPress={() =>
              router.push(
                insight.kind === "gap"
                  ? {
                      pathname: "/product/search",
                      params: {
                        query: insight.query,
                        category: insight.category,
                        maxPrice: String(data.profile.preferences.budget),
                        size: data.profile.preferences.size,
                      },
                    }
                  : "/outfit/build",
              )
            }
          />
        </Card>
      ))}
      <Txt muted style={{ fontSize: 12 }}>
        These observations are guidance, not a reason to buy more. Your existing
        wardrobe comes first.
      </Txt>
    </Screen>
  );
}
