import { demoApiRequest } from "../../services/demoLive";
import React, { useState } from "react";
import { Switch } from "react-native";
import {
  Screen,
  Field,
  Button,
  Card,
  Txt,
  Row,
  ignore,
} from "../../components/ui";
import { useApp, friendlyError } from "../../state/AppProvider";
import { apiRequest } from "../../services/api";
import { CitiesSchema } from "../../features/weather/useWeather";
import { z } from "zod";
export default function WeatherSettings() {
  const { data, user, execute, busy, services } = useApp();
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<z.infer<typeof CitiesSchema>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!data) return null;
  const pref = data.profile.weather;
  return (
    <Screen
      back
      title="A little weather wisdom."
      subtitle="Choose a city. Precise location is never requested."
    >
      <Card>
        <Row between>
          <Txt>Weather personalization</Txt>
          <Switch
            accessibilityLabel="Enable weather personalization"
            value={!!pref?.enabled}
            disabled={!pref || busy}
            onValueChange={(enabled) =>
              ignore(
                execute({
                  type: "profile",
                  profile: { ...data.profile, weather: { ...pref!, enabled } },
                }),
              )
            }
          />
        </Row>
        <Txt muted>{pref?.name || "Choose a city below to enable."}</Txt>
      </Card>
      <Field
        label="City"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Austin"
      />
      <Button
        title="Find city"
        loading={loading}
        disabled={query.trim().length < 2 || services.mode !== "live"}
        onPress={() =>
          ignore(
            (async () => {
              setLoading(true);
              setError("");
              try {
                setCities(
                  await (user?.mode === "demo" ? demoApiRequest : apiRequest)(
                    "/v1/weather/cities",
                    CitiesSchema,
                    {
                      query,
                    },
                  ),
                );
              } catch (e) {
                setError(friendlyError(e));
              } finally {
                setLoading(false);
              }
            })(),
          )
        }
      />
      {services.mode !== "live" && (
        <Txt muted>
          Sign in to use live city weather. Demo styling works without it.
        </Txt>
      )}
      {!!error && <Txt>{error}</Txt>}
      {cities.map((c) => (
        <Card
          key={c.name + c.latitude}
          onPress={() =>
            ignore(
              execute(
                {
                  type: "profile",
                  profile: {
                    ...data.profile,
                    weather: { ...c, enabled: true },
                  },
                },
                "City saved. Future looks can use the weather.",
              ),
            )
          }
        >
          <Txt>{c.name}</Txt>
          <Txt muted>
            {pref?.name === c.name ? "Selected ✓" : "Use this city"}
          </Txt>
        </Card>
      ))}
      {loading === false && query.length > 1 && !cities.length && !error && (
        <Txt muted>
          Search to choose your city. You can turn personalization off anytime.
        </Txt>
      )}
      <Txt muted>
        Weather by Open-Meteo, licensed CC BY 4.0. Cached for 15 minutes; older
        observations are labeled. Free noncommercial hackathon use. Forecasts
        are guidance, not a guarantee.
      </Txt>
    </Screen>
  );
}
