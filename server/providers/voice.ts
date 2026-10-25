import {
  ApiError,
  RequestCache,
  UsageMeter,
  hash,
  providerFetch,
} from "../core";
import { Config } from "../config";
import { z } from "zod";
/** Validate RIFF chunks and resample only PCM16 mono. No shell decoder or arbitrary file access. */
export function normalizedWave(base64: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    throw new ApiError(
      400,
      "INVALID_AUDIO",
      "Record a short voice note, or use text entry.",
    );
  const bytes = Buffer.from(base64, "base64");
  if (
    bytes.length < 44 ||
    bytes.length > 3_100_000 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new ApiError(
      400,
      "INVALID_AUDIO",
      "Use a readable WAV voice recording under30 seconds.",
    );
  let rate = 0,
    channels = 0,
    bits = 0,
    format = 0,
    pcm: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4),
      size = bytes.readUInt32LE(offset + 4),
      start = offset + 8;
    if (size > bytes.length - start)
      throw new ApiError(
        400,
        "INVALID_AUDIO",
        "This voice recording is incomplete. Record it again.",
      );
    if (name === "fmt " && size >= 16) {
      format = bytes.readUInt16LE(start);
      channels = bytes.readUInt16LE(start + 2);
      rate = bytes.readUInt32LE(start + 4);
      bits = bytes.readUInt16LE(start + 14);
    }
    if (name === "data") pcm = bytes.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (
    format !== 1 ||
    channels !== 1 ||
    bits !== 16 ||
    ![16000, 24000, 44100, 48000].includes(rate) ||
    !pcm?.length ||
    pcm.length % 2
  )
    throw new ApiError(
      400,
      "AUDIO_FORMAT",
      "Record mono PCM audio, or use text entry instead.",
    );
  const durationMs = (pcm.length / 2 / rate) * 1000;
  if (durationMs < 300 || durationMs > 31000)
    throw new ApiError(
      400,
      "AUDIO_DURATION",
      "Keep your voice description between1 and30 seconds.",
    );
  const samples = Math.floor(((pcm.length / 2) * 24000) / rate),
    out = Buffer.alloc(44 + samples * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(24000, 24);
  out.writeUInt32LE(48000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const position = (i * rate) / 24000,
      lo = Math.min(Math.floor(position), pcm.length / 2 - 1),
      hi = Math.min(lo + 1, pcm.length / 2 - 1),
      fraction = position - lo;
    out.writeInt16LE(
      Math.round(
        pcm.readInt16LE(lo * 2) * (1 - fraction) +
          pcm.readInt16LE(hi * 2) * fraction,
      ),
      44 + i * 2,
    );
  }
  return { bytes: out, durationMs: Math.round(durationMs) };
}
export class VoiceProvider {
  constructor(
    private config: Config,
    private cache: RequestCache,
    private usage: UsageMeter,
  ) {}
  async transcribe(uid: string, base64: string) {
    const audio = normalizedWave(base64);
    if (!this.config.MODEL_API_KEY)
      throw new ApiError(
        503,
        "META_UNCONFIGURED",
        "Voice transcription is not configured. Text entry still works.",
      );
    return this.cache.get(
      `voice-v1:${uid}:${this.config.META_ASR_MODEL}:${hash(audio.bytes)}`,
      30 * 60000,
      async () => {
        await this.usage.count("meta", this.config.MAX_META_CALLS_PER_DAY);
        const form = new FormData();
        form.append(
          "request",
          new Blob(
            [
              JSON.stringify({
                model: this.config.META_ASR_MODEL,
                audioEncoding: "WAV",
                mode: "PUSH_TO_TALK",
              }),
            ],
            { type: "application/json" },
          ),
        );
        form.append(
          "audio",
          new Blob([new Uint8Array(audio.bytes)], { type: "audio/wav" }),
          "wardrobe.wav",
        );
        const result = z
          .object({
            transcript: z.string().max(5000),
            audioDurationMs: z.number().nonnegative(),
          })
          .parse(
            await providerFetch(
              `${this.config.META_API_BASE_URL}/asr/transcribe`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${this.config.MODEL_API_KEY}`,
                  Accept: "application/json",
                },
                body: form,
              },
              35000,
            ),
          );
        await this.usage.audio(Math.floor(result.audioDurationMs / 1000));
        if (!result.transcript.trim())
          throw new ApiError(
            422,
            "NO_SPEECH",
            "No speech was detected. Try again or type your list.",
          );
        return {
          text: result.transcript.trim(),
          durationMs: result.audioDurationMs,
        };
      },
    );
  }
}
