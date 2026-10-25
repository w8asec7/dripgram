import sharp from "sharp";
import { ApiError } from "../core";
import { Config } from "../config";
import { ImagePayloadSchema } from "../../shared/protocol";
import { z } from "zod";
export async function prepareImage(input: z.infer<typeof ImagePayloadSchema>) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))
    throw new ApiError(
      400,
      "INVALID_IMAGE",
      "Choose a readable JPEG, PNG or WebP image.",
    );
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length > 3_000_000 || bytes.length < 16)
    throw new ApiError(400, "IMAGE_SIZE", "Choose an image smaller than 3 MB.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    }).rotate();
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || "")) throw new Error();
    const inference = await image
      .clone()
      .resize({
        width: 768,
        height: 768,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#f7f6f2" })
      .jpeg({ quality: 75 })
      .toBuffer();
    const thumbnail = await image
      .clone()
      .resize(256, 256, { fit: "contain", background: "#f7f6f2" })
      .flatten({ background: "#f7f6f2" })
      .jpeg({ quality: 76 })
      .toBuffer();
    return { inference, thumbnail };
  } catch {
    throw new ApiError(
      400,
      "INVALID_IMAGE",
      "This image could not be read. Choose another photo or enter details manually.",
    );
  }
}
export function storagePath(uid: string, id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new ApiError(
      400,
      "INVALID_PATH",
      "This garment identifier is invalid.",
    );
  return `users/${uid}/garments/${id}/thumbnail.jpg`;
}
export class SupabaseImages {
  constructor(private config: Config) {}
  private async call(path: string, options: RequestInit = {}) {
    const key =
      this.config.SUPABASE_SECRET_KEY || this.config.SUPABASE_SERVICE_ROLE_KEY;
    if (!this.config.SUPABASE_URL || !key)
      throw new ApiError(
        503,
        "STORAGE_UNCONFIGURED",
        "Cloud image storage is unavailable. Your local thumbnail is safe.",
      );
    let r: Response;
    try {
      r = await fetch(`${this.config.SUPABASE_URL}/storage/v1/${path}`, {
        ...options,
        headers: {
          apikey: key,
          ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "Cloud image sync failed. Your local thumbnail is safe; try Sync photo again.",
      );
    }
    if (!r.ok)
      throw new ApiError(
        503,
        "STORAGE_ERROR",
        "Cloud image storage could not complete the request. Your local thumbnail is safe.",
      );
    return r;
  }
  async verifyBucket() {
    const r = await this.call(
      `bucket/${encodeURIComponent(this.config.SUPABASE_STORAGE_BUCKET)}`,
    );
    const bucket = (await r.json()) as { id: string; public: boolean };
    if (
      bucket.id !== this.config.SUPABASE_STORAGE_BUCKET ||
      bucket.public !== false
    )
      throw new ApiError(
        503,
        "BUCKET_PRIVACY",
        "The configured bucket must exist and be private. No bucket permissions were changed.",
      );
    return true;
  }
  async upload(path: string, bytes: Buffer) {
    await this.verifyBucket();
    await this.call(
      `object/${encodeURIComponent(this.config.SUPABASE_STORAGE_BUCKET)}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: new Uint8Array(bytes),
      },
    );
    return this.sign(path);
  }
  async sign(path: string, seconds = 300) {
    const r = await this.call(
      `object/sign/${encodeURIComponent(this.config.SUPABASE_STORAGE_BUCKET)}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: seconds }),
      },
    );
    const j = (await r.json()) as { signedURL?: string };
    if (!j.signedURL)
      throw new ApiError(
        502,
        "SIGNED_URL",
        "The image link could not be prepared. Please retry.",
      );
    return {
      path,
      signedUrl: new URL(
        j.signedURL.startsWith("/storage/v1/")
          ? j.signedURL
          : `/storage/v1${j.signedURL}`,
        this.config.SUPABASE_URL,
      ).href,
      expiresAt: Date.now() + seconds * 1000,
      syncedAt: new Date().toISOString(),
    };
  }
  async remove(path: string) {
    await this.call(
      `object/${encodeURIComponent(this.config.SUPABASE_STORAGE_BUCKET)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      },
    );
  }
}
