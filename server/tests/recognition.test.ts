import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { regionColor, verifyObservedColor } from "../providers/color";
import { prepareImage } from "../providers/images";
import { RecognitionSchema } from "../../shared/protocol";
import { reviewAnalysis } from "../../src/features/recognition/review";
import { seedGarments } from "../../src/mocks/seed";
test("red garment remains red through preprocessing, response parsing, editable review and metadata persistence", async () => {
  const bytes = await readFile("tests/fixtures/red-shirt.jpg");
  const processed = await prepareImage({
    base64: bytes.toString("base64"),
    mimeType: "image/jpeg",
  });
  const region = { x: 0.18, y: 0.1, width: 0.64, height: 0.8 };
  const model = RecognitionSchema.parse({
    name: "Red Oversized T-Shirt",
    category: "t-shirt",
    subcategory: "tee",
    silhouette: "relaxed",
    texture: [],
    garmentRegion: region,
    primaryColor: "cream",
    secondaryColors: [],
    pattern: "solid",
    fit: "unknown",
    styleTags: ["Casual"],
    brand: null,
    material: null,
    season: [],
    occasions: [],
    description: "A red tee",
    searchKeywords: ["red t shirt"],
    uncertainFields: [],
    confidence: "medium",
  });
  const corrected = await verifyObservedColor(processed.inference, model);
  assert.equal(corrected.primaryColor, "red");
  assert.ok(corrected.colorReview.includes("confirm"));
  const reviewed = reviewAnalysis(
    seedGarments[0],
    corrected,
    new Set(["name"]),
  );
  assert.equal(reviewed.primaryColor, "red");
  assert.equal(JSON.parse(JSON.stringify(reviewed)).primaryColor, "red");
});
test("a red background cannot override a white garment in the selected region", async () => {
  const image = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#dd2020" },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 100,
            height: 160,
            channels: 3,
            background: "#fefefe",
          },
        })
          .png()
          .toBuffer(),
        left: 50,
        top: 20,
      },
    ])
    .jpeg()
    .toBuffer();
  assert.equal(
    await regionColor(image, { x: 0.25, y: 0.1, width: 0.5, height: 0.8 }),
    null,
  );
  assert.equal(
    (
      await verifyObservedColor(image, {
        primaryColor: "white",
        secondaryColors: [],
        uncertainFields: [],
        garmentRegion: { x: 0.25, y: 0.1, width: 0.5, height: 0.8 },
      })
    ).primaryColor,
    "white",
  );
  assert.equal(await regionColor(image, null), null);
});

test("all garment fixtures preserve image identity, metadata color and category mappings", async () => {
  const cases = [
    ["white-oversized-tshirt.jpg", "white", "t-shirt"],
    ["black-hoodie.jpg", "black", "hoodie"],
    ["blue-jeans.jpg", "blue", "jeans"],
    ["beige-pants.jpg", "beige", "trousers"],
    ["patterned-shirt.jpg", "blue", "shirt"],
  ] as const;
  for (const [file, color, category] of cases) {
    const original = await readFile("tests/fixtures/" + file);
    const { inference, thumbnail } = await prepareImage({
      base64: original.toString("base64"),
      mimeType: "image/jpeg",
    });
    assert.ok(inference.length > 0);
    assert.ok(thumbnail.length > 0);
    const result = reviewAnalysis(
      seedGarments[0],
      { primaryColor: color, category },
      new Set(),
    );
    assert.equal(result.primaryColor, color);
    assert.equal(result.category, category);
    assert.equal(JSON.parse(JSON.stringify(result)).primaryColor, color);
  }
  const red = await readFile("tests/fixtures/red-shirt.jpg");
  const rotated = await sharp(red)
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const processed = await prepareImage({
    base64: rotated.toString("base64"),
    mimeType: "image/jpeg",
  });
  assert.equal(
    (await sharp(processed.inference).metadata()).orientation,
    undefined,
  );
});
