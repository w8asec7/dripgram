/** Opt-in single-fixture inference smoke. Never opens a camera. */
import { readFile } from "node:fs/promises";
import { loadConfig } from "./config";
import { RecognitionSchema } from "../shared/protocol";
loadConfig();
async function main() {
  if (process.env.THREAD_RUN_LIVE_QA !== "1")
    throw new Error(
      "Set THREAD_RUN_LIVE_QA=1 to spend one bounded inference request.",
    );
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const signup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const auth = (await signup.json()) as { idToken?: string };
  if (!signup.ok || !auth.idToken)
    throw new Error("Temporary anonymous QA authentication failed.");
  try {
    const photo = await readFile("tests/fixtures/red-shirt.jpg");
    const start = Date.now();
    const response = await fetch("http://127.0.0.1:3001/v1/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify({
        base64: photo.toString("base64"),
        mimeType: "image/jpeg",
      }),
    });
    const raw = (await response.json()) as {
      analysis?: unknown;
      error?: { code?: string };
    };
    if (!response.ok)
      throw new Error(`Analysis failed: ${raw.error?.code || response.status}`);
    const result = RecognitionSchema.parse(raw.analysis ?? raw);
    if (
      result.primaryColor.toLowerCase() !== "red" ||
      result.category !== "t-shirt"
    )
      throw new Error("Red-shirt fixture classification failed.");
    console.info(
      JSON.stringify({
        test: "real red-shirt fixture through authenticated backend",
        pass: true,
        elapsedMs: Date.now() - start,
        category: result.category,
        color: result.primaryColor,
        model: process.env.META_MODEL || "muse-spark-1.2",
        mode: "Standard",
      }),
    );
  } finally {
    const cleanup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: auth.idToken }),
      },
    );
    if (!cleanup.ok) throw new Error("Temporary QA account cleanup failed.");
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live QA failed");
  process.exitCode = 1;
});
