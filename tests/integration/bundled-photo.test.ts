import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { imagePayload } from "../../src/services/api";
const fixture = require("node:fs")
  .readFileSync("assets/photography/tee-red-photo.jpg")
  .toString("base64");
jest.mock("../../src/mocks/images", () => ({
  garmentImages: { "licensed-photo": 42 },
}));
jest.mock("../../src/repositories/firebase", () => ({ cloudAuth: jest.fn() }));
jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      uri: "https://assets.example.test/garment.jpg",
      localUri: "file:///app/cache/licensed.jpg",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));
jest.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: jest.fn(),
}));
test("photo-only demo post analysis sends actual bundled image bytes, never its display key", async () => {
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(fixture);
  const result = await imagePayload("licensed-photo");
  expect(Asset.fromModule).toHaveBeenCalledWith(42);
  expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
    "file:///app/cache/licensed.jpg",
    { encoding: "base64" },
  );
  expect(result.base64).toBe(fixture);
  expect(result.mimeType).toBe("image/jpeg");
});
