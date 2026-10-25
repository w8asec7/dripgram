/** Crop licensed photographs to the relevant garment. Never recolor or generate clothing. */
const { Buffer } = require("node:buffer");
const fs = require("node:fs/promises");
const sharp = require("sharp");
const crops = {
  "tee-cream": [0, 0.1, 1, 0.8],
  "hoodie-sage": [0.12, 0.2, 0.84, 0.78],
  "hoodie-grey": [0.07, 0.1, 0.85, 0.9],
  "pants-sand": [0.3, 0.48, 0.65, 0.52],
  "pants-black": [0.45, 0.35, 0.24, 0.62],
  "jeans-blue": [0.48, 0.08, 0.36, 0.82],
  "jacket-olive": [0.22, 0.32, 0.68, 0.65],
  "shirt-blue": [0.15, 0.27, 0.65, 0.65],
  "shirt-navy": [0.1, 0.22, 0.84, 0.53],
  "sweater-oat": [0.05, 0.42, 0.9, 0.58],
  "shorts-sand": [0.35, 0.4, 0.22, 0.38],
  "bag-black": [0.21, 0.22, 0.59, 0.46],
  "cap-green": [0.12, 0.06, 0.68, 0.57],
};
(async () => {
  for (const [key, [x, y, w, h]] of Object.entries(crops)) {
    const path = `assets/photography/${key}.jpg`,
      original = `.private-cache/photo-original-${key}.jpg`;
    try {
      await fs.access(original);
    } catch {
      await fs.copyFile(path, original);
    }
    let input = original;
    let meta = await sharp(input).metadata();
    if (meta.width * w < 550 || meta.height * h < 550) {
      const high = `.private-cache/photo-hires-${key}.jpg`;
      try {
        await fs.access(high);
      } catch {
        const sources = JSON.parse(
          await fs.readFile("assets/photography/sources.json", "utf8"),
        );
        const source = sources.find((p) => p.key === key);
        if (!source) throw new Error("Missing licensed crop source.");
        const response = await fetch(
          `https://images.pexels.com/photos/${source.id}/pexels-photo-${source.id}.jpeg?auto=compress&w=3200`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok)
          throw new Error(`Photo source unavailable (${response.status}).`);
        await fs.writeFile(high, Buffer.from(await response.arrayBuffer()));
      }
      input = high;
      meta = await sharp(input).metadata();
    }
    await sharp(input)
      .extract({
        left: Math.round(x * meta.width),
        top: Math.round(y * meta.height),
        width: Math.floor(w * meta.width),
        height: Math.floor(h * meta.height),
      })
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(path);
  }
  console.log("Garment-focused photographic crops complete.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
