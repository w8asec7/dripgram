import React, { useCallback } from "react";
import { z } from "zod";
import { Screen, Txt, Card, Badge, Button, Row } from "../../components/ui";
import { useApp } from "../../state/AppProvider";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { apiBaseUrl, apiRequest } from "../../services/api";
const Health = z.object({
  ok: z.boolean(),
  model: z.string(),
  mode: z.string(),
  meta: z.boolean(),
  shopping: z.boolean(),
  storage: z.boolean(),
  automaticPriceTracking: z.boolean(),
});
const Usage = z.object({
  usage: z.object({
    metaRequests: z.number(),
    serpRequests: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    day: z.string(),
  }),
  limits: z.object({ metaPerDay: z.number(), serpPerDay: z.number() }),
  model: z.string(),
  mode: z.string(),
});
export default function ServiceSettings() {
  const { user } = useApp();
  const resource = useAsyncResource(
    useCallback(async () => {
      const response = await fetch(apiBaseUrl() + "/health", {
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok)
        throw new Error(
          "Backend unavailable. Start npm run backend and verify your Wi-Fi connection.",
        );
      const health = Health.parse(await response.json());
      const usage =
        user?.mode === "firebase" ? await apiRequest("/v1/usage", Usage) : null;
      return { health, usage };
    }, [user?.mode]),
  );
  return (
    <Screen
      back
      title="Connected, thoughtfully."
      subtitle="Clear service status and conservative request budgets."
    >
      <Card>
        <Txt>Backend: {apiBaseUrl()}</Txt>
        <Txt muted style={{ fontSize: 12 }}>
          Expo Go uses your computer’s LAN host. Use a configured HTTPS backend
          URL when connecting through a tunnel.
        </Txt>
        <Badge>
          {user?.mode === "firebase"
            ? "LIVE SERVICES FOR YOUR ACCOUNT"
            : "OFFLINE DEMO · SIGN IN FOR LIVE SERVICES"}
        </Badge>
      </Card>
      {resource.loading && <Txt>Checking service configuration…</Txt>}
      {!!resource.error && (
        <Card>
          <Txt>{resource.error}</Txt>
          <Button title="Retry connection" onPress={resource.retry} />
        </Card>
      )}
      {resource.value && (
        <>
          <Card>
            <Txt serif style={{ fontSize: 25 }}>
              {resource.value.health.model}
            </Txt>
            <Badge>{resource.value.health.mode.toUpperCase()} MODE</Badge>
            <Txt muted>
              Contributor models are blocked. Configuration status does not by
              itself prove a provider call succeeded.
            </Txt>
            {(["meta", "shopping", "storage"] as const).map((key) => (
              <Row between key={key}>
                <Txt>
                  {
                    {
                      meta: "Meta AI",
                      shopping: "SerpApi Shopping & Lens",
                      storage: "Private Supabase thumbnails",
                    }[key]
                  }
                </Txt>
                <Badge>
                  {resource.value!.health[key] ? "CONFIGURED" : "MISSING"}
                </Badge>
              </Row>
            ))}
          </Card>
          {resource.value.usage && (
            <Card>
              <Txt serif style={{ fontSize: 25 }}>
                Backend usage today
              </Txt>
              <Txt>
                {resource.value.usage.usage.metaRequests} Meta attempts ·{" "}
                {resource.value.usage.usage.serpRequests} search attempts
              </Txt>
              <Txt muted>
                {resource.value.usage.usage.inputTokens} input tokens ·{" "}
                {resource.value.usage.usage.outputTokens} output tokens reported
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Daily backend caps: {resource.value.usage.limits.metaPerDay}{" "}
                Meta / {resource.value.usage.limits.serpPerDay} searches. Counts
                are for this backend installation. Promotional balances are not
                known.
              </Txt>
            </Card>
          )}
          <Button
            title="Refresh status"
            variant="secondary"
            onPress={resource.retry}
          />
        </>
      )}
      <Card>
        <Txt style={{ fontWeight: "600" }}>
          Price watches refresh when you ask.
        </Txt>
        <Txt muted>
          No automatic scheduler is enabled. Only observed provider prices are
          saved.
        </Txt>
      </Card>
    </Screen>
  );
}
