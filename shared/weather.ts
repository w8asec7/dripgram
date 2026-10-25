import { z } from "zod";
export const CitySchema = z.object({
  name: z.string().min(1).max(140),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().max(100),
});
export const WeatherPreferenceSchema = CitySchema.extend({
  enabled: z.boolean(),
});
export const WeatherSchema = z.object({
  city: z.string(),
  temperatureF: z.number(),
  rain: z.boolean(),
  observedAt: z.string().datetime(),
  fetchedAt: z.string().datetime(),
  source: z.literal("Open-Meteo"),
});
export type Weather = z.infer<typeof WeatherSchema>;
export function weatherGuidance(w: Weather | null | undefined) {
  if (!w || Date.now() - Date.parse(w.observedAt) > 3600000)
    return "unavailable";
  return w.temperatureF >= 78 ? "hot" : w.temperatureF <= 65 ? "cool" : "mild";
}
