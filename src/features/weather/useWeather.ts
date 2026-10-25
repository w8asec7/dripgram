import { demoApiRequest, syncDemoWardrobe } from "../../services/demoLive";
import { useEffect, useState } from "react";
import { useApp } from "../../state/AppProvider";
import { Weather, WeatherSchema } from "../../../shared/weather";
import { apiRequest } from "../../services/api";
import { z } from "zod";
const cache = new Map<string, { value: Weather | null; at: number }>();
const pending = new Map<string, Promise<Weather | null>>();
export function useWeather() {
  const { data, user, services } = useApp();
  const pref = data?.profile.weather;
  const key = user?.id + ":" + JSON.stringify(pref);
  const [state, setState] = useState<{
    key: string;
    weather: Weather | null;
    error: string;
  }>({ key: "", weather: null, error: "" });
  useEffect(() => {
    let active = true;
    if (!pref?.enabled || services.mode !== "live") return;
    const cached = cache.get(key);
    let request = pending.get(key);
    if (!request) {
      request =
        cached && Date.now() - cached.at < 15 * 60000
          ? Promise.resolve(cached.value)
          : (async () => {
              if (user?.mode === "demo") await syncDemoWardrobe();
              return (user?.mode === "demo" ? demoApiRequest : apiRequest)(
                "/v1/weather",
                WeatherSchema.nullable(),
                {},
              );
            })().then((value) => {
              cache.set(key, { value, at: Date.now() });
              return value;
            });
      pending.set(key, request);
    }
    void request
      .then((weather) => {
        if (active) setState({ key, weather, error: "" });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            weather: cached?.value || null,
            error: "Weather unavailable. Your closet still works.",
          });
      })
      .finally(() => pending.delete(key));
    return () => {
      active = false;
    };
  }, [key, pref?.enabled, user?.mode, services.mode]);
  return {
    weather: state.key === key && pref?.enabled ? state.weather : null,
    error: state.key === key ? state.error : "",
    enabled: !!pref?.enabled,
    demo: user?.mode === "demo" && services.mode !== "live",
  };
}
export const CitiesSchema = z.array(
  z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
  }),
);
