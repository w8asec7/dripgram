import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  localGarments,
  resolveThumbnail,
  prepareLocalImages,
  cleanupTemporaryImage,
  removeDraftThumbnail,
} from "../../src/services/images";
import { cloudImages } from "../../src/services/api";
import { seedData } from "../../src/mocks/seed";
jest.mock("../../src/services/api", () => ({
  cloudImages: { sign: jest.fn(), upload: jest.fn(), remove: jest.fn() },
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///app/documents/",
  cacheDirectory: "file:///app/cache/",
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
}));
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
test("local garments survive reload and retry without duplicate IDs or cross-user exposure", async () => {
  const g = seedData().garments[0];
  await localGarments.save({
    ...g,
    image: {
      uri: "file:///local-thumb.jpg",
      source: "camera",
      syncStatus: "failed",
    },
  });
  await localGarments.save({
    ...g,
    name: "Edited locally",
    image: {
      uri: "file:///local-thumb.jpg",
      source: "camera",
      syncStatus: "failed",
    },
  });
  expect(await localGarments.list("other-user")).toEqual([]);
  const saved = await localGarments.list(g.ownerId);
  expect(saved).toHaveLength(1);
  expect(saved[0].name).toBe("Edited locally");
  expect(saved[0].image?.syncStatus).toBe("failed");
  await localGarments.remove(g.ownerId, g.id);
  expect(await localGarments.list(g.ownerId)).toEqual([]);
});
test("missing local thumbnails resolve via authorized short-lived URLs and can refresh expired links", async () => {
  const sign = jest.mocked(cloudImages.sign);
  sign
    .mockResolvedValueOnce({
      path: "users/alice/garments/fixture-image/thumbnail.jpg",
      signedUrl: "https://fixture.example/first",
      expiresAt: Date.now() + 300000,
      syncedAt: new Date().toISOString(),
    })
    .mockResolvedValueOnce({
      path: "users/alice/garments/fixture-image/thumbnail.jpg",
      signedUrl: "https://fixture.example/refreshed",
      expiresAt: Date.now() + 300000,
      syncedAt: new Date().toISOString(),
    });
  const image = {
    uri: "https://fixture.example/expired",
    ownerId: "alice",
    garmentId: "fixture-image",
    storagePath: "users/alice/garments/fixture-image/thumbnail.jpg",
    source: "library" as const,
    syncStatus: "synced" as const,
  };
  expect(await resolveThumbnail(image)).toBe("https://fixture.example/first");
  expect(await resolveThumbnail(image)).toBe("https://fixture.example/first");
  expect(sign).toHaveBeenCalledTimes(1);
  expect(await resolveThumbnail(image, undefined, true)).toBe(
    "https://fixture.example/refreshed",
  );
  expect(sign).toHaveBeenCalledTimes(2);
});
test("failed signed retrieval propagates a recoverable failure and never invents a URL", async () => {
  jest
    .mocked(cloudImages.sign)
    .mockRejectedValue(new Error("Private image access denied."));
  await expect(
    resolveThumbnail({
      uri: "https://old",
      ownerId: "bob",
      garmentId: "new-private",
      storagePath: "users/bob/garments/new-private/thumbnail.jpg",
      source: "library",
    }),
  ).rejects.toThrow("Private image access denied.");
});

test("native thumbnail drafts use new persistent files and cleanup never deletes camera-roll originals", async () => {
  const manipulate = jest.mocked(ImageManipulator.manipulateAsync);
  for (let i = 0; i < 2; i++)
    manipulate
      .mockResolvedValueOnce({
        uri: "file:///app/cache/inference.jpg",
        width: 512,
        height: 768,
      })
      .mockResolvedValueOnce({
        uri: "file:///app/cache/thumb.jpg",
        width: 171,
        height: 256,
      });
  const first = await prepareLocalImages(
    "file:///camera-roll/original.jpg",
    1200,
    1800,
    "alice",
    "tee",
  );
  const second = await prepareLocalImages(
    "file:///camera-roll/replacement.jpg",
    1200,
    1800,
    "alice",
    "tee",
  );
  expect(first.thumbnailUri).not.toBe(second.thumbnailUri);
  expect(first.thumbnailUri).toMatch(
    /^file:\/\/\/app\/documents\/thumbnails\/alice\/tee\//,
  );
  expect(FileSystem.copyAsync).toHaveBeenCalledTimes(2);
  jest.mocked(FileSystem.deleteAsync).mockClear();
  await cleanupTemporaryImage("file:///camera-roll/original.jpg");
  await removeDraftThumbnail("file:///camera-roll/original.jpg");
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  await removeDraftThumbnail(second.thumbnailUri);
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(second.thumbnailUri, {
    idempotent: true,
  });
});
test("web committed thumbnails resolve locally and are isolated by owner", async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  try {
    const g = seedData().garments[0];
    const uri = "data:image/jpeg;base64,fixture";
    await localGarments.save({
      ...g,
      image: {
        uri,
        source: "library",
        ownerId: g.ownerId,
        garmentId: g.id,
        storagePath: "private-path",
      },
    });
    expect(
      await resolveThumbnail({
        uri: "https://expired.example",
        source: "library",
        ownerId: g.ownerId,
        garmentId: g.id,
        storagePath: "private-path",
      }),
    ).toBe(uri);
    expect(cloudImages.sign).not.toHaveBeenCalled();
    expect(
      await AsyncStorage.getItem(`thread.thumbnail.other-user.${g.id}`),
    ).toBeNull();
  } finally {
    Object.defineProperty(Platform, "OS", {
      value: original,
      configurable: true,
    });
  }
});
