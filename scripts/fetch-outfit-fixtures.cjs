/** Download two explicitly licensed clothing-photo QA fixtures; no private account or API key. */
const { Buffer } = require("node:buffer");
const fs = require("node:fs/promises");
const sharp = require("sharp");
const photos = [
  {
    file: "pexels-salomon-byuma-9322977.jpg",
    url: "https://images.pexels.com/photos/9322977/pexels-photo-9322977.jpeg?auto=compress&w=768",
    source:
      "https://www.pexels.com/photo/man-in-white-long-sleeves-and-beige-pants-9322977/",
    author: "Salomon Byuma",
    license: "https://www.pexels.com/license/",
  },
  {
    file: "unsplash-curtis-ambayo-kQ_DRtuQzG8.jpg",
    url: "https://images.unsplash.com/photo-1598898499167-1f52a48743b8?auto=format&fit=max&w=768&q=80",
    source:
      "https://unsplash.com/photos/man-in-white-dress-shirt-and-beige-pants-standing-beside-yellow-wall-kQ_DRtuQzG8",
    author: "Curtis Ambayo",
    license: "https://unsplash.com/license",
  },
];
(async () => {
  const dir = ".private-cache/outfit-photo-qa";
  await fs.mkdir(dir, { recursive: true });
  for (const photo of photos) {
    const r = await fetch(photo.url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error(`Fixture download failed: ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    await sharp(bytes)
      .rotate()
      .resize({ width: 768, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(`${dir}/${photo.file}`);
  }
  await fs.writeFile(`${dir}/sources.json`, JSON.stringify(photos, null, 2));
  console.log(
    "Two licensed outfit photo fixtures retained privately; no model calls performed.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
