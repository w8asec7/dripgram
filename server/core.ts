import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { readFileSync } from "node:fs";
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export async function providerFetch(
  url: string,
  options: RequestInit = {},
  timeout = 35000,
): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw new ApiError(
      504,
      "PROVIDER_TIMEOUT",
      "The provider could not be reached. Please try again shortly.",
    );
  }
  if (!r.ok) {
    // Inspect only recognized error classes; never forward provider bodies,
    // which can contain echoed prompts, signed URLs or credentials.
    if (r.status === 413)
      throw new ApiError(
        413,
        "IMAGE_PAYLOAD_LIMIT",
        "This photo is too large to analyze. Choose a smaller photo or enter details manually.",
      );
    if (r.status === 400) {
      const detail: unknown = await r.json().catch(() => null);
      const text = JSON.stringify(detail).slice(0, 8000);
      if (
        /context[_ ]?(length|window)|maximum context|too many input tokens|input.{0,30}token.{0,20}limit/i.test(
          text,
        )
      )
        throw new ApiError(
          422,
          "MODEL_CONTEXT_LIMIT",
          "The AI input exceeded its context limit. Choose a closer garment photo or enter details manually.",
        );
    }
    if (r.status === 429)
      throw new ApiError(
        429,
        "PROVIDER_LIMIT",
        "The provider is temporarily rate-limited or out of credits. Try again later.",
        60,
      );
    if (r.status === 401 || r.status === 403)
      throw new ApiError(
        503,
        "PROVIDER_CONFIGURATION",
        "This service could not authenticate with its provider. Check the backend configuration.",
      );
    throw new ApiError(
      502,
      "PROVIDER_ERROR",
      "The provider could not complete this request. Please try again.",
    );
  }
  try {
    return await r.json();
  } catch {
    throw new ApiError(
      502,
      "PROVIDER_RESPONSE",
      "The provider returned unreadable data. Please retry.",
    );
  }
}
export class RequestCache {
  private pending = new Map<string, Promise<unknown>>();
  private memory = new Map<string, { expires: number; value: unknown }>();
  constructor(private directory?: string) {}
  async get<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const filename = hash(key);
    const running = this.pending.get(filename);
    if (running) return running as Promise<T>;
    const task = (async () => {
      let hit = this.memory.get(filename);
      if (!hit && this.directory) {
        try {
          hit = JSON.parse(
            await readFile(join(this.directory, filename + ".json"), "utf8"),
          );
        } catch {
          /* Cache miss. */
        }
      }
      if (hit && hit.expires > Date.now()) return hit.value as T;
      const value = await loader();
      const entry = { expires: Date.now() + ttlMs, value };
      this.memory.set(filename, entry);
      if (this.directory) {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const target = join(this.directory, filename + ".json");
        await writeFile(target + ".tmp", JSON.stringify(entry), {
          mode: 0o600,
        });
        await rename(target + ".tmp", target);
      }
      return value;
    })().finally(() => this.pending.delete(filename));
    this.pending.set(filename, task);
    return task;
  }
}
export type Usage = {
  audioSeconds?: number;
  metaRequests: number;
  serpRequests: number;
  inputTokens: number;
  outputTokens: number;
  day: string;
};
export class UsageMeter {
  private totals: Usage = {
    metaRequests: 0,
    serpRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    day: new Date().toISOString().slice(0, 10),
  };
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file?: string) {
    if (file) {
      try {
        this.totals = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        /* New installation. */
      }
      this.loaded = true;
    }
  }
  private serialize<T>(fn: () => Promise<T>) {
    const job = this.queue.then(fn);
    this.queue = job.catch(() => undefined);
    return job;
  }
  count(provider: "meta" | "serp", limit: number) {
    return this.serialize(async () => {
      if (!this.loaded) {
        if (this.file) {
          try {
            this.totals = JSON.parse(await readFile(this.file, "utf8"));
          } catch {
            /* First run. */
          }
        }
        this.loaded = true;
      }
      const day = new Date().toISOString().slice(0, 10);
      if (this.totals.day !== day)
        this.totals = {
          metaRequests: 0,
          serpRequests: 0,
          inputTokens: 0,
          outputTokens: 0,
          day,
        };
      const key = provider === "meta" ? "metaRequests" : "serpRequests";
      if (this.totals[key] >= limit)
        throw new ApiError(
          429,
          "DAILY_BUDGET",
          "The configured daily request budget has been reached.",
          3600,
        );
      this.totals[key]++;
      await this.save();
    });
  }
  audio(seconds: number) {
    return this.serialize(async () => {
      this.totals.audioSeconds = (this.totals.audioSeconds || 0) + seconds;
      await this.save();
    });
  }
  tokens(input: number, output: number) {
    return this.serialize(async () => {
      this.totals.inputTokens += input;
      this.totals.outputTokens += output;
      await this.save();
    });
  }
  snapshot() {
    return { ...this.totals };
  }
  private async save() {
    if (this.file) {
      await mkdir(join(this.file, ".."), { recursive: true, mode: 0o700 });
      await writeFile(this.file, JSON.stringify(this.totals), { mode: 0o600 });
    }
  }
}
export function parseModelJson(text: string): unknown {
  try {
    return JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new ApiError(
      502,
      "MODEL_OUTPUT",
      "AI returned an unreadable answer. Try again or enter details manually.",
    );
  }
}
