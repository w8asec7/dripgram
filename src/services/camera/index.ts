import { validateImageMetadata } from "../../utils/imageMetadata";
import * as ImagePicker from "expo-image-picker";
export interface SelectedImage {
  uri: string;
  width: number;
  height: number;
  source: "camera" | "library";
}
export const cameraService = {
  async selectFromLibrary(): Promise<SelectedImage | null> {
    // The system photo picker grants access only to selected images; no broad library permission needed.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return null;
    const a = result.assets[0];
    validateImageMetadata(a);
    return {
      uri: a.uri,
      width: a.width,
      height: a.height,
      source: "library",
    };
  },
  // Called only by an explicit user action. Never activate during automated QA.
  async capture(): Promise<SelectedImage | null> {
    const existing = await ImagePicker.getCameraPermissionsAsync();
    const permission =
      existing.status === "undetermined"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : existing;
    if (!permission.granted)
      throw new Error(
        "Camera access is off. Enable it in device settings, or use your photo library.",
      );
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return null;
    const a = result.assets[0];
    validateImageMetadata(a);
    return {
      uri: a.uri,
      width: a.width,
      height: a.height,
      source: "camera",
    };
  },
};
