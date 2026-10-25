/** Read only named demo/social records and app-owned image files; never session credentials. */
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { fileURLToPath } = require("node:url");
const uid =
  process.env.THREAD_QA_SIMULATOR || "EDD93D5A-77A3-4109-981B-0115E7D8383D";
const container = execFileSync(
  "xcrun",
  ["simctl", "get_app_container", uid, "host.exp.Exponent", "data"],
  { encoding: "utf8" },
).trim();
const experience = path.join(
    container,
    "Documents/ExponentExperienceData/@anonymous",
  ),
  project = fs
    .readdirSync(experience)
    .find((p) => p.startsWith("thread-wardrobe-"));
if (!project) throw Error("Thread experience missing.");
const root = path.join(experience, project, "RCTAsyncLocalStorage"),
  manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  );
function read(key) {
  const raw =
    manifest[key] === null
      ? fs.readFileSync(
          path.join(root, crypto.createHash("md5").update(key).digest("hex")),
          "utf8",
        )
      : manifest[key];
  if (!raw) throw Error(`Missing expected demo QA record: ${key}`);
  return JSON.parse(raw);
}
const data = read("thread.demo.v1"),
  social = read("thread.posts.v1.demo"),
  chat = read("thread.chat.v1.demo.styleGroups/weekend/messages");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const archiveKey = "thread.posts.photo-archive.v1";
const archive = archiveKey in manifest ? read(archiveKey) : [];
const photos = [
  ...new Map([...social.posts, ...archive].map((p) => [p.id, p])).values(),
]
  .filter((p) => p.ownerId === "demo" && p.image?.uri?.startsWith("file:"))
  .map((p) => {
    const file = fileURLToPath(p.image.uri);
    if (!file.startsWith(path.join(experience, project)))
      throw Error("Unexpected photo location.");
    const bytes = fs.readFileSync(file);
    return {
      postId: p.id,
      bytes: bytes.length,
      sha256: hash(bytes),
      attributionPresent: p.caption.includes("Pexels"),
    };
  });
if (!photos.length || !photos.every((p) => p.bytes > 100))
  throw Error("Saved social photo was not retained.");
if (!data.outfits.some((o) => o.name === "My closet remix"))
  throw Error("Saved native remix missing.");
if (!chat.some((m) => m.post)) throw Error("Shared post message missing.");
const report = {
  garmentCount: data.garments.length,
  archivedOriginalPosts: archive.length,
  userPostCount: social.posts.filter((p) => p.ownerId === "demo").length,
  photos,
  remixCount: data.outfits.filter((o) => o.name === "My closet remix").length,
  messageCount: chat.length,
  postMessages: chat.filter((m) => m.post).length,
  wearHistoryHash: hash(JSON.stringify(data.wears)),
  garmentIdsHash: hash(JSON.stringify(data.garments.map((g) => g.id).sort())),
};
fs.writeFileSync(
  ".private-cache/simulator-qa/social-persistence.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
