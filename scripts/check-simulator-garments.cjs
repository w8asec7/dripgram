/** Read only Thread's demo records/thumbnail files in a named simulator; never credentials or originals. */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { fileURLToPath } = require("node:url");
const sharp = require("sharp");
async function main() {
  const udid =
    process.env.THREAD_QA_SIMULATOR || "EDD93D5A-77A3-4109-981B-0115E7D8383D";
  const container = execFileSync(
    "xcrun",
    ["simctl", "get_app_container", udid, "host.exp.Exponent", "data"],
    { encoding: "utf8" },
  ).trim();
  const experienceRoot = path.join(
    container,
    "Documents",
    "ExponentExperienceData",
    "@anonymous",
  );
  const project = fs
    .readdirSync(experienceRoot)
    .find((name) => name.startsWith("thread-wardrobe-"));
  if (!project) throw new Error("Thread simulator storage not found.");
  const root = path.join(experienceRoot, project, "RCTAsyncLocalStorage");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  );
  const key = "thread.demo.v1";
  const value =
    manifest[key] === null
      ? fs.readFileSync(
          path.join(root, crypto.createHash("md5").update(key).digest("hex")),
          "utf8",
        )
      : manifest[key];
  const data = JSON.parse(value);
  const archiveKey = "thread.demo.photo-archive.v1";
  const archiveRaw =
    manifest[archiveKey] === null
      ? fs.readFileSync(
          path.join(
            root,
            crypto.createHash("md5").update(archiveKey).digest("hex"),
          ),
          "utf8",
        )
      : manifest[archiveKey];
  const archive = archiveRaw ? JSON.parse(archiveRaw) : [];
  const retained = [
    ...new Map([...data.garments, ...archive].map((g) => [g.id, g])).values(),
  ];
  const garments = [];
  for (const garment of retained.filter((g) => g.image?.source === "library")) {
    const file = fileURLToPath(garment.image.uri);
    if (!file.startsWith(path.join(experienceRoot, project)))
      throw new Error("Unexpected thumbnail location.");
    const bytes = fs.readFileSync(file),
      metadata = await sharp(bytes).metadata();
    garments.push({
      id: garment.id,
      name: garment.name,
      category: garment.category,
      primaryColor: garment.primaryColor,
      fit: garment.fit,
      brand: garment.brand,
      description: garment.description,
      styleTags: garment.styleTags,
      material: garment.material,
      subcategory: garment.subcategory,
      silhouette: garment.silhouette,
      texture: garment.texture,
      thumbnail: {
        width: metadata.width,
        height: metadata.height,
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        permanent: true,
      },
      createdAt: garment.createdAt,
    });
  }
  const originalManifest = JSON.parse(
    fs.readFileSync(
      ".private-cache/real-garment-qa/original-manifest.json",
      "utf8",
    ),
  );
  for (const image of originalManifest) {
    const current = crypto
      .createHash("sha256")
      .update(
        fs.readFileSync(
          path.join(require("node:os").homedir(), "Downloads", image.name),
        ),
      )
      .digest("hex");
    if (current !== image.sha256) throw new Error("An original image changed.");
  }
  const report = {
    simulator: udid,
    garmentCount: data.garments.length,
    archivedOriginalGarments: archive.length,
    originalsStillRetained: true,
    recognizedGarments: garments.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
    originalsUnchanged: true,
  };
  fs.mkdirSync(".private-cache/simulator-qa", { recursive: true });
  fs.writeFileSync(
    ".private-cache/simulator-qa/saved-garments.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
