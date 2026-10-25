import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";
import { seedGarments } from "../../src/mocks/seed";
test("every legacy demo garment resolves to bundled, static licensed photography; originals are never needed at runtime", async () => {
  const sources = JSON.parse(
    await readFile("assets/photography/sources.json", "utf8"),
  ) as { key: string; source: string; license: string; author: string }[];
  const files = await readdir("assets/photography");
  assert.equal(
    files.filter((f) => /\.(gif|png|svg|webp|mp4)$/i.test(f)).length,
    0,
  );
  for (const source of sources) {
    assert.equal(new URL(source.source).hostname, "www.pexels.com");
    assert.equal(source.license, "https://www.pexels.com/license/");
    assert.ok(source.author.length > 0);
    const meta = await sharp(
      await readFile(`assets/photography/${source.key}.jpg`),
    ).metadata();
    assert.equal(meta.format, "jpeg");
    assert.ok(meta.width! >= 128 && meta.height! >= 128);
    assert.ok(!meta.pages || meta.pages === 1);
  }
  for (const garment of seedGarments)
    assert.ok(sources.some((s) => s.key === garment.image?.uri));
  const mapping = await readFile("src/mocks/images.ts", "utf8");
  assert.ok(!mapping.includes("assets/garments") && !mapping.includes(".png"));
});

test("garment crops used in enlarged demo views retain enough source detail", async () => {
  for (const key of ["pants-black", "shorts-sand", "jeans-blue"]) {
    const metadata = await sharp(`assets/photography/${key}.jpg`).metadata();
    assert.ok(metadata.width! >= 512, `${key} must not regress to a tiny crop`);
  }
});
