import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { z } from "zod";
// This module is server-only. The mobile dependency graph must never import it.
const local = resolve(process.cwd(), ".env");
if (existsSync(local)) {
  const values = parseEnv(readFileSync(local, "utf8"));
  for (const [key, value] of Object.entries(values))
    if (process.env[key] === undefined) process.env[key] = value;
}
export const ConfigSchema = z.object({
  MODEL_API_KEY: z.string().default(""),
  META_ASR_MODEL: z
    .literal("muse-voice-transcribe-1.0")
    .default("muse-voice-transcribe-1.0"),
  META_MODEL: z
    .string()
    .default("muse-spark-1.2")
    .refine(
      (v) => !v.toLowerCase().includes("contributor"),
      "Contributor models are disabled. Standard mode is required.",
    ),
  META_API_BASE_URL: z
    .url()
    .default("https://api.meta.ai/v1")
    .refine(
      (v) => v === "https://api.meta.ai/v1",
      "Use the official Meta endpoint.",
    ),
  META_REASONING_EFFORT: z.enum(["minimal", "low"]).default("minimal"),
  META_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(128)
    .max(4096)
    .default(2400),
  SERPAPI_API_KEY: z.string().default(""),
  SUPABASE_URL: z
    .string()
    .default("")
    .transform((v) => (v ? new URL(v).origin : "")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  SUPABASE_SECRET_KEY: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default("hackTx"),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  PORT: z.coerce.number().int().default(3001),
  PROVIDER_TIMEOUT_MS: z.coerce.number().min(1000).max(60000).default(35000),
  MAX_META_CALLS_PER_DAY: z.coerce.number().int().positive().default(100),
  MAX_SERP_CALLS_PER_DAY: z.coerce.number().int().positive().default(80),
  ALLOWED_WEB_ORIGINS: z
    .string()
    .default(
      "http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081",
    ),
});
export type Config = z.infer<typeof ConfigSchema>;
export function loadConfig(): Config {
  return ConfigSchema.parse(process.env);
}
