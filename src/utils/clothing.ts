import type { ClothingMode } from "../models";
export const modeLabel = (mode?: ClothingMode) =>
  mode === "men"
    ? "Men’s"
    : mode === "women"
      ? "Women’s"
      : "Choose your preference";
export function fitOptions(mode?: ClothingMode) {
  const common = [
    "unknown",
    "regular",
    "relaxed",
    "oversized",
    "slim",
    "cropped",
    "baggy",
    "straight-leg",
    "wide-leg",
    "tapered",
    "tailored",
  ];
  return mode === "women"
    ? [
        "unknown",
        "fitted",
        "relaxed",
        "oversized",
        "cropped",
        "flowy",
        "a-line",
        ...common.filter(
          (f) => !["unknown", "relaxed", "oversized", "cropped"].includes(f),
        ),
      ]
    : common;
}
