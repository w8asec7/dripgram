import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { Weather } from "../../shared/weather";
import { Card, Row, Icon, Txt } from "./ui";
export function WeatherSummary({
  weather,
  error,
  enabled,
  demo,
}: {
  weather: Weather | null;
  error: string;
  enabled: boolean;
  demo: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const stale = weather && now - Date.parse(weather.observedAt) > 3600000;
  return (
    <Card onPress={() => router.push("/settings/weather")}>
      <Row>
        <Icon name={weather?.rain ? "cloud-rain" : "sun"} />
        <Txt style={{ flex: 1 }}>
          {weather
            ? `${Math.round(weather.temperatureF)}°F · ${weather.rain ? "Rain expected" : weather.temperatureF >= 78 ? "Warm" : weather.temperatureF <= 65 ? "Cool" : "Mild"}${stale ? " · Earlier report" : ""}`
            : enabled
              ? error || "Loading city weather…"
              : "Dress for your day · Add city weather"}
        </Txt>
        <Icon name="chevron-right" />
      </Row>
      {weather && (
        <Txt muted style={{ fontSize: 11 }}>
          {weather.city} · Open-Meteo · observed{" "}
          {new Date(weather.observedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Txt>
      )}
      {enabled && demo && (
        <Txt muted>Live weather is available after signing in.</Txt>
      )}
    </Card>
  );
}
