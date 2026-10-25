/** Licensed real photography only. Sources/derivative crops are recorded beside assets. */
const { Buffer } = require("node:buffer");
const fs = require("node:fs/promises");
const sharp = require("sharp");
const photos = [
  [
    "tee-cream",
    37704838,
    "Daniel & Hannah Snipes",
    "minimalist-fashion-flat-lay-of-white-t-shirt",
  ],
  ["tee-black", 8532616, "Hanna Pad", "a-black-shirt-hanging-on-the-wall"],
  ["tee-rose", 9558265, "MART PRODUCTION", "orange-crew-neck-t-shirt"],
  ["hoodie-sage", 9775675, "SHVETS production", "a-man-wearing-a-green-hoodie"],
  ["hoodie-grey", 907863, "Maurício Mascaro", "man-wearing-gray-hoodie"],
  [
    "pants-sand",
    9322977,
    "Salomon Byuma",
    "man-in-white-long-sleeves-and-beige-pants",
  ],
  ["pants-black", 10217710, "Amar Preciado", "a-man-holding-a-black-pants"],
  [
    "jeans-blue",
    1082528,
    "Mica Asato",
    "two-hanged-blue-stonewash-and-blue-jeans",
  ],
  [
    "jacket-olive",
    27378027,
    "Darya Grey_Owl",
    "young-tourist-in-olive-jacket-by-the-sea",
  ],
  ["jacket-rust", 9222629, "cottonbro studio", "man-in-a-bright-orange-jacket"],
  [
    "shirt-blue",
    9558723,
    "MART PRODUCTION",
    "blue-button-up-shirt-hanging-on-white-metal-bar",
  ],
  ["shirt-navy", 22441317, "dayong tien", "dark-blue-shirt-on-hanger"],
  ["sweater-oat", 7760243, "cottonbro studio", "a-woman-in-beige-sweater"],
  [
    "shorts-sand",
    2287357,
    "Marcelo Dias",
    "man-in-white-t-shirt-and-beige-shorts-holding-two-sticks",
  ],
  ["shoes-white", 11324525, "Hurrah suhail", "photo-of-white-sneakers"],
  [
    "shoes-brown",
    8394709,
    "Jovie Pujadas Ladura",
    "brown-leather-slip-on-shoes-near-wristwatch",
  ],
  ["bag-black", 1502217, "Ray Piedra", "black-crossbody-bag-on-chair"],
  ["cap-green", 12650833, "x", "green-cap-and-smartphone-on-sand"],
  ["look-formal", 13360982, "Eduardo Ordone", "man-in-black-suit-standing"],
  [
    "look-casual",
    34614494,
    "Alexander Mass",
    "young-woman-crossing-city-street-in-casual-outfit",
  ],
  [
    "look-smart",
    9322977,
    "Salomon Byuma",
    "man-in-white-long-sleeves-and-beige-pants",
  ],
  [
    "look-tonal",
    12056637,
    "Elina Volkova",
    "a-man-in-beige-sweater-and-beige-pants",
  ],
  [
    "look-street",
    21701014,
    "mohamed abdelghaffar",
    "man-wearing-checked-jacket-on-a-street",
  ],
  [
    "look-layered",
    16166526,
    "Atahan Demir",
    "man-in-denim-jacket-and-hoodie-standing-on-street",
  ],
  ["look-summer", 24561192, "Mustapha Damilola", "casual-style-man-in-jacket"],
  [
    "look-vintage",
    30615470,
    "Wolrider YURTSEVEN",
    "fashionable-man-in-vintage-streetwear-jacket",
  ],
];
(async () => {
  const dir = "assets/photography";
  await fs.mkdir(dir, { recursive: true });
  const sources = photos.map(([key, id, author, slug]) => ({
    key,
    id,
    author,
    source: `https://www.pexels.com/photo/${slug}-${id}/`,
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&w=1200`,
    license: "https://www.pexels.com/license/",
    changes:
      "Resized/compressed; some garment derivatives cropped to garment, no color alterations.",
  }));
  for (let i = 0; i < sources.length; i += 4)
    await Promise.all(
      sources.slice(i, i + 4).map(async (p) => {
        const dest = `${dir}/${p.key}.jpg`;
        try {
          await fs.access(dest);
          return;
        } catch {}
        const r = await fetch(p.url, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw Error(`${p.key}: ${r.status}`);
        await sharp(Buffer.from(await r.arrayBuffer()))
          .rotate()
          .resize({
            width: p.key.startsWith("look-") ? 900 : 700,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 83 })
          .toFile(dest);
      }),
    );
  await fs.writeFile(
    `${dir}/sources.json`,
    JSON.stringify(sources, null, 2) + "\n",
  );
  const tiles = await Promise.all(
    sources.map(async (p, i) => ({
      input: await sharp(`${dir}/${p.key}.jpg`)
        .resize(180, 240, { fit: "contain", background: "#fff" })
        .extend({ bottom: 26, background: "#fff" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="180" height="26"><text x="4" y="18" font-size="12">${p.key}</text></svg>`,
            ),
            top: 240,
            left: 0,
          },
        ])
        .png()
        .toBuffer(),
      left: (i % 6) * 180,
      top: Math.floor(i / 6) * 266,
    })),
  );
  await sharp({
    create: {
      width: 1080,
      height: Math.ceil(sources.length / 6) * 266,
      channels: 3,
      background: "#fff",
    },
  })
    .composite(tiles)
    .jpeg()
    .toFile(".private-cache/fashion-contact.jpg");
  console.log(
    `${sources.length} licensed real photographs downloaded locally. No provider credits used.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
