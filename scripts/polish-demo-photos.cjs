/** Reproducible licensed, real-photo additions. Never reads or alters personal originals. */
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const sharp = require("sharp");
const photos = [
  [
    "look-everyday",
    3856022,
    "Matheus Bertelli",
    "man-in-white-crew-neck-t-shirt-and-black-pants",
  ],
  [
    "look-hoodie",
    4295985,
    "Lappen Fashion",
    "man-wearing-gray-sweater-and-blue-denim-jeans",
  ],
  [
    "look-basics",
    6539638,
    "Jhay NaLang Po",
    "man-in-black-crew-neck-t-shirt-and-beige-pants",
  ],
  [
    "tee-blue-photo",
    22613978,
    "Ali Babajahdi",
    "a-blue-t-shirt-hanging-on-a-wall",
  ],
  [
    "tee-red-photo",
    19456417,
    "Jonathan Borba",
    "portrait-of-man-wearing-red-t-shirt",
  ],
];
(async () => {
  const sources = JSON.parse(
    fs.readFileSync("assets/photography/sources.json", "utf8"),
  );
  for (const [key, id, author, slug] of photos) {
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&w=1000`;
    const dest = `assets/photography/${key}.jpg`;
    if (!fs.existsSync(dest)) {
      const r = await fetch(url);
      if (!r.ok) throw Error(`Licensed photo download: ${r.status}`);
      let image = sharp(Buffer.from(await r.arrayBuffer())).rotate();
      if (key === "tee-red-photo") {
        const m = await image.metadata();
        image = image.extract({
          left: 0,
          top: Math.round(m.height * 0.53),
          width: m.width,
          height: Math.round(m.height * 0.47) - 1,
        });
      }
      await image
        .resize({
          width: 768,
          height: 960,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toFile(dest);
    }
    if (!sources.some((s) => s.key === key))
      sources.push({
        key,
        id,
        author,
        source: `https://www.pexels.com/photo/${slug}-${id}/`,
        url,
        license: "https://www.pexels.com/license/",
        changes:
          "Resized and compressed. Red tee derivative cropped below face; representative shade/fit, no recoloring.",
      });
  }
  for (const [key, source, box] of [
    ["avatar-maya", "look-casual", [0.38, 0.27, 0.25, 0.2]],
    ["avatar-alex", "look-everyday", [0.32, 0.02, 0.36, 0.27]],
    ["avatar-jordan", "look-hoodie", [0.34, 0.05, 0.34, 0.34]],
  ]) {
    const photo = sharp(`assets/photography/${source}.jpg`),
      metadata = await photo.metadata();
    await photo
      .extract({
        left: Math.floor(metadata.width * box[0]),
        top: Math.floor(metadata.height * box[1]),
        width: Math.floor(metadata.width * box[2]),
        height: Math.floor(metadata.height * box[3]),
      })
      .resize(160, 160, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toFile(`assets/photography/${key}.jpg`);
    if (!sources.some((p) => p.key === key))
      sources.push({
        ...sources.find((p) => p.key === source),
        key,
        changes:
          "Square portrait crop for explicitly fictional sample profile; no endorsement.",
      });
  }
  fs.writeFileSync(
    "assets/photography/sources.json",
    JSON.stringify(sources, null, 2) + "\n",
  );
})();
