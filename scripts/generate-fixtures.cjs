// Original synthetic test art, CC0. Does not manipulate or capture personal photos.
const { Buffer } = require("node:buffer");
const sharp = require("sharp");
const path =
  "M190 70 L250 65 Q300 100 350 65 L410 70 L540 195 L455 260 L410 210 L410 535 L190 535 L190 210 L145 260 L60 195 Z";
async function main() {
  for (const [file, color, background, seam] of [
    ["red-shirt.jpg", "#d32624", "#f3efe5", "#a91c20"],
    ["white-oversized-tshirt.jpg", "#ffffff", "#b9c0c4", "#dddddd"],
  ])
    await sharp(
      Buffer.from(
        `<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="600" fill="${background}"/><path fill="${color}" d="${path}"/><path d="M250 65 Q300 145 350 65" fill="none" stroke="${seam}" stroke-width="10"/></svg>`,
      ),
    )
      .jpeg({ quality: 90 })
      .toFile("tests/fixtures/" + file);
}
main().catch(() => {
  process.exitCode = 1;
});
