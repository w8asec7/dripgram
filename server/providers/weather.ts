import { z } from "zod";
import { CitySchema, WeatherSchema } from "../../shared/weather";
import { RequestCache, providerFetch, hash } from "../core";
export class WeatherProvider {
  constructor(private cache: RequestCache) {}
  cities(query: string) {
    return this.cache.get(
      `cities:${hash(query.toLowerCase())}`,
      86400000,
      async () => {
        const raw = z
          .object({
            results: z
              .array(
                z.object({
                  name: z.string(),
                  admin1: z.string().optional(),
                  country: z.string().optional(),
                  latitude: z.number(),
                  longitude: z.number(),
                  timezone: z.string(),
                }),
              )
              .optional(),
          })
          .parse(
            await providerFetch(
              "https://geocoding-api.open-meteo.com/v1/search?" +
                new URLSearchParams({
                  name: query,
                  count: "5",
                  language: "en",
                  format: "json",
                }),
              {},
              10000,
            ),
          );
        return (raw.results || []).map((c) =>
          CitySchema.parse({
            ...c,
            name: [c.name, c.admin1, c.country].filter(Boolean).join(", "),
          }),
        );
      },
    );
  }
  current(city: z.infer<typeof CitySchema>) {
    return this.cache.get(
      `weather:${hash(JSON.stringify(city))}`,
      15 * 60000,
      async () => {
        const params = new URLSearchParams({
          latitude: String(city.latitude),
          longitude: String(city.longitude),
          current: "temperature_2m,precipitation,weather_code",
          hourly: "precipitation_probability",
          temperature_unit: "fahrenheit",
          timezone: "UTC",
          timeformat: "unixtime",
          forecast_days: "1",
        });
        const raw = z
          .object({
            current: z.object({
              time: z.number(),
              temperature_2m: z.number(),
              precipitation: z.number(),
              weather_code: z.number(),
            }),
            hourly: z
              .object({
                time: z.array(z.number()),
                precipitation_probability: z.array(z.number().nullable()),
              })
              .optional(),
          })
          .parse(
            await providerFetch(
              "https://api.open-meteo.com/v1/forecast?" + params,
              {},
              10000,
            ),
          );
        const now = raw.current.time;
        const upcoming = raw.hourly?.time.some(
          (t, i) =>
            t >= now &&
            t < now + 6 * 3600 &&
            (raw.hourly?.precipitation_probability[i] ?? 0) >= 50,
        );
        return WeatherSchema.parse({
          city: city.name,
          temperatureF: raw.current.temperature_2m,
          rain:
            raw.current.precipitation > 0 ||
            raw.current.weather_code >= 51 ||
            !!upcoming,
          observedAt: new Date(now * 1000).toISOString(),
          fetchedAt: new Date().toISOString(),
          source: "Open-Meteo",
        });
      },
    );
  }
}
