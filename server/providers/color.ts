import sharp from "sharp";
import { normalizeColor } from "../../src/features/recognition/review";
export type GarmentRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};
/** Corroboration, not whole-photo averaging or a calibrated confidence score. */
export async function regionColor(bytes: Buffer, region: GarmentRegion | null) {
  if (
    !region ||
    region.width < 0.1 ||
    region.height < 0.1 ||
    region.x + region.width > 1.02 ||
    region.y + region.height > 1.02
  )
    return null;
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  if (!width || !height) return null;
  const left = Math.max(
      0,
      Math.floor((region.x + region.width * 0.16) * width),
    ),
    top = Math.max(0, Math.floor((region.y + region.height * 0.16) * height));
  const w = Math.min(
      width - left,
      Math.max(1, Math.floor(region.width * 0.68 * width)),
    ),
    h = Math.min(
      height - top,
      Math.max(1, Math.floor(region.height * 0.68 * height)),
    );
  const { data, info } = await sharp(bytes)
    .extract({ left, top, width: w, height: h })
    .resize(80, 80, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts: Record<string, number> = {};
  let samples = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      delta = max - min;
    samples++;
    if (max < 0.18 || delta < 0.16 || delta / max < 0.32) continue;
    let hue =
      (max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) * 60;
    if (hue < 0) hue += 360;
    const name =
      hue < 16 || hue >= 345
        ? "red"
        : hue < 44
          ? "orange"
          : hue < 70
            ? "yellow"
            : hue < 165
              ? "green"
              : hue < 255
                ? "blue"
                : hue < 290
                  ? "purple"
                  : "pink";
    counts[name] = (counts[name] || 0) + 1;
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return best && best[1] / samples > 0.55 ? best[0] : null;
}
export async function verifyObservedColor<
  T extends {
    primaryColor: string;
    secondaryColors: string[];
    uncertainFields: string[];
    garmentRegion: GarmentRegion | null;
  },
>(image: Buffer, analysis: T) {
  const observed = await regionColor(image, analysis.garmentRegion);
  const color = normalizeColor(analysis.primaryColor);
  const disagree =
    observed &&
    ["cream", "white", "beige", "grey", "light grey", "unknown"].includes(
      color,
    ) &&
    observed !== color;
  return {
    ...analysis,
    primaryColor: disagree ? observed : color,
    secondaryColors: analysis.secondaryColors.map(normalizeColor),
    uncertainFields: [
      ...new Set([
        ...analysis.uncertainFields,
        ...(disagree ? ["primaryColor"] : []),
      ]),
    ],
    colorReview: disagree
      ? `The garment-region pixels suggest ${observed}, while the model suggested ${color}. Please confirm the color.`
      : "",
  };
}
