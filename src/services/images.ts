import type { ChatTarget } from "../models/chat";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { Garment, GarmentSchema, makeId } from "../models";
import { z } from "zod";
import { cloudImages } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
const thumbnailKey = (uid: string, id: string) =>
  `thread.thumbnail.${uid}.${id}`;
function thumbnailDirectory(uid: string, id: string) {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
    !FileSystem.documentDirectory
  )
    throw new Error("Local image storage is unavailable for this garment.");
  return `${FileSystem.documentDirectory}thumbnails/${uid}/${id}/`;
}
export async function removeDraftThumbnail(uri: string) {
  if (
    Platform.OS !== "web" &&
    FileSystem.documentDirectory &&
    uri.startsWith(`${FileSystem.documentDirectory}thumbnails/`)
  )
    await FileSystem.deleteAsync(uri, { idempotent: true });
}
async function persistentCopy(uri: string, uid: string, id: string) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Could not retain this thumbnail."));
      reader.readAsDataURL(blob);
    });
    return data;
  }
  const directory = thumbnailDirectory(uid, id);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const file = `${directory}${makeId("thumbnail")}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: file });
  return file;
}
export async function prepareLocalImages(
  uri: string,
  width: number,
  height: number,
  uid: string,
  id: string,
) {
  const inferenceSize =
    width >= height
      ? { width: Math.min(width, 1024) }
      : { height: Math.min(height, 1024) };
  const thumbnailSize = width >= height ? { width: 256 } : { height: 256 };
  const inference = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: inferenceSize }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  const thumb = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: thumbnailSize }],
    { compress: 0.76, format: ImageManipulator.SaveFormat.JPEG },
  );
  const thumbnailUri = await persistentCopy(thumb.uri, uid, id);
  if (Platform.OS !== "web" && thumb.uri !== thumbnailUri)
    await cleanupTemporaryImage(thumb.uri);
  return {
    inferenceUri: inference.uri,
    thumbnailUri,
    width: thumb.width,
    height: thumb.height,
  };
}
export async function cleanupTemporaryImage(uri: string) {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
    return;
  }
  const cache = FileSystem.cacheDirectory;
  if (cache && uri.startsWith(cache))
    await FileSystem.deleteAsync(uri, { idempotent: true });
}
export async function removeLocalThumbnail(uid: string, id: string) {
  await AsyncStorage.removeItem(thumbnailKey(uid, id));
  if (Platform.OS !== "web") {
    const dir = FileSystem.documentDirectory;
    if (dir)
      await FileSystem.deleteAsync(thumbnailDirectory(uid, id), {
        idempotent: true,
      });
    if (dir)
      await FileSystem.deleteAsync(`${dir}thumbnails/${uid}-${id}.jpg`, {
        idempotent: true,
      });
  }
}
const signed = new Map<string, { uri: string; expires: number }>();
export function clearThumbnailCache() {
  signed.clear();
}
export async function resolveThumbnail(
  image: NonNullable<Garment["image"]>,
  occasionId?: string,
  force = false,
  lookId?: string,
  chat?: ChatTarget & { messageId: string },
) {
  if (image.source === "bundled") return image.uri;
  const uid = image.ownerId,
    id = image.garmentId;
  if (!uid || !id || !image.storagePath) return image.uri;
  if (!force) {
    if (Platform.OS === "web") {
      const local = await AsyncStorage.getItem(thumbnailKey(uid, id));
      if (local) return local;
    } else if (image.uri.startsWith("file:")) {
      if ((await FileSystem.getInfoAsync(image.uri)).exists) return image.uri;
    }
  }
  const key = `${uid}:${id}:${image.syncedAt || ""}:${occasionId || ""}:${lookId || ""}:${chat ? JSON.stringify(chat) : ""}`;
  const cached = signed.get(key);
  if (!force && cached && cached.expires > Date.now() + 30000)
    return cached.uri;
  const result = await cloudImages.sign(uid, id, occasionId, lookId, chat);
  signed.set(key, { uri: result.signedUrl, expires: result.expiresAt });
  return result.signedUrl;
}
export const localGarments = {
  async list(uid: string): Promise<Garment[]> {
    const raw = await AsyncStorage.getItem(`thread.local-garments.${uid}`);
    if (!raw) return [];
    return z.array(GarmentSchema).parse(JSON.parse(raw));
  },
  async save(garment: Garment) {
    const all = await this.list(garment.ownerId);
    if (Platform.OS === "web" && garment.image?.uri.startsWith("data:image/"))
      await AsyncStorage.setItem(
        thumbnailKey(garment.ownerId, garment.id),
        garment.image.uri,
      );
    await AsyncStorage.setItem(
      `thread.local-garments.${garment.ownerId}`,
      JSON.stringify([...all.filter((g) => g.id !== garment.id), garment]),
    );
  },
  async remove(uid: string, id: string) {
    await AsyncStorage.setItem(
      `thread.local-garments.${uid}`,
      JSON.stringify((await this.list(uid)).filter((g) => g.id !== id)),
    );
  },
};

export async function prepareInferenceImage(
  uri: string,
  width: number,
  height: number,
) {
  return ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize:
          width >= height
            ? { width: Math.min(width, 1024) }
            : { height: Math.min(height, 1024) },
      },
    ],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
}

/** Retain a compressed display photo for a social post, never the full-resolution original. */
export async function preparePostImage(
  uri: string,
  width: number,
  height: number,
  uid: string,
  id: string,
) {
  const size =
    width >= height
      ? { width: Math.min(width, 768) }
      : { height: Math.min(height, 768) };
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: size }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  const retained = await persistentCopy(resized.uri, uid, id);
  await cleanupTemporaryImage(resized.uri);
  return retained;
}
