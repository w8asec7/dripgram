import { Asset } from "expo-asset";
import { garmentImages } from "../mocks/images";
import { shoppingMeasurement } from "./performance";
import type { ChatTarget } from "../models/chat";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { cloudAuth } from "../repositories/firebase";
import { z } from "zod";
import {
  ErrorEnvelopeSchema,
  ImagePayloadSchema,
  SyncResultSchema,
} from "../../shared/protocol";
import * as FileSystem from "expo-file-system/legacy";
export function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:3001`;
  if (Platform.OS === "web" && typeof window !== "undefined")
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  return "http://127.0.0.1:3001";
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  tokenOverride?: string,
): Promise<T> {
  const started = performance.now();
  const shopping = path.startsWith("/v1/shopping/");
  let token = tokenOverride;
  if (!token) {
    const user = cloudAuth().currentUser;
    if (!user) throw new Error("Sign in before using live services.");
    token = await user.getIdToken();
  }
  if (shopping)
    shoppingMeasurement({ phase: "token", ms: performance.now() - started });
  const fetchStart = performance.now();
  let response: Response;
  try {
    response = await fetch(apiBaseUrl() + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    throw new Error(
      "Couldn’t reach the wardrobe backend. Check that it’s running and your phone is on the same Wi-Fi, then retry.",
    );
  }
  if (shopping)
    shoppingMeasurement({
      phase: "http",
      ms: performance.now() - fetchStart,
      serverTiming: response.headers.get("Server-Timing") || undefined,
    });
  const parseStart = performance.now();
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error(
      "The backend returned an unreadable response. Please retry.",
    );
  }
  if (!response.ok) {
    const err = ErrorEnvelopeSchema.safeParse(raw);
    throw new Error(
      err.success
        ? err.data.error.message
        : "The request could not be completed. Please try again.",
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new Error("The service returned unexpected data. Please retry.");
  if (shopping)
    shoppingMeasurement({
      phase: "decode_validate",
      ms: performance.now() - parseStart,
    });
  return result.data;
}
export async function imagePayload(uri: string) {
  const bundled = garmentImages[uri];
  if (typeof bundled === "number" || typeof bundled === "string") {
    const asset = Asset.fromModule(bundled);
    await asset.downloadAsync();
    uri = asset.localUri || asset.uri;
  } else if (
    bundled &&
    !Array.isArray(bundled) &&
    "uri" in bundled &&
    typeof bundled.uri === "string"
  )
    uri = bundled.uri;
  let base64: string;
  if (uri.startsWith("data:")) {
    base64 = uri.slice(uri.indexOf(",") + 1);
  } else if (Platform.OS !== "web" && uri.startsWith("file:"))
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  else {
    const response = await fetch(uri);
    if (!response.ok)
      throw new Error("Could not read this image. Choose it again.");
    const blob = await response.blob();
    base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(new Error("Could not read this photo."));
      r.readAsDataURL(blob);
    });
  }
  return ImagePayloadSchema.parse({
    base64,
    mimeType: uri.startsWith("data:image/png") ? "image/png" : "image/jpeg",
  });
}
export const cloudImages = {
  async upload(garmentId: string, uri: string) {
    return apiRequest("/v1/images/thumbnail", SyncResultSchema, {
      garmentId,
      image: await imagePayload(uri),
    });
  },
  sign(
    ownerId: string,
    garmentId: string,
    occasionId?: string,
    lookId?: string,
    chat?: ChatTarget & { messageId: string },
  ) {
    return apiRequest("/v1/images/sign", SyncResultSchema, {
      ownerId,
      garmentId,
      occasionId,
      lookId,
      chat,
    });
  },
  remove(garmentId: string) {
    return apiRequest(
      "/v1/images/thumbnail",
      z.object({ deleted: z.boolean() }),
      { garmentId },
      "DELETE",
    );
  },
};
