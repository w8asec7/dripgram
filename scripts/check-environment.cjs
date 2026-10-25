const { Buffer } = require("node:buffer");
// Prints names/statuses only, never credentials or environment file contents.
const fs = require("node:fs");
const cp = require("node:child_process");
const { parseEnv } = require("node:util");
const env = parseEnv(fs.readFileSync(".env", "utf8"));
const secrets = [
  "MODEL_API_KEY",
  "SERPAPI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
];
const required = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "MODEL_API_KEY",
  "META_MODEL",
  "SERPAPI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_STORAGE_BUCKET",
];
let failure = false;
for (const name of required) {
  const present = !!env[name]?.trim();
  console.log(`${name}: ${present ? "present" : "MISSING"}`);
  if (!present) failure = true;
}
console.log(
  "Supabase privileged key:",
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY
    ? "present"
    : "MISSING",
);
if (!(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)) failure = true;
console.log(
  "Bucket name:",
  env.SUPABASE_STORAGE_BUCKET === "hackTx" ? "exact expected name" : "MISMATCH",
);
console.log(
  "Standard mode:",
  !/contributor/i.test(env.META_MODEL || "") ? "YES" : "NO",
);
if (
  env.SUPABASE_STORAGE_BUCKET !== "hackTx" ||
  /contributor/i.test(env.META_MODEL || "")
)
  failure = true;
const tracked = cp
  .execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const files = tracked.filter(
  (p) => /(^|\/)\.env(?:\.|$)/.test(p) && !p.endsWith(".env.example"),
);
console.log("Tracked secret environment files:", files.length);
if (files.length) {
  console.log(
    "Removing only environment files from Git index, preserving local files.",
  );
  cp.execFileSync("git", ["rm", "--cached", "--", ...files], {
    stdio: "ignore",
  });
}
let currentLeaks = 0;
for (const f of tracked) {
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
  const content = fs.readFileSync(f);
  for (const key of secrets)
    if (env[key]?.length > 10 && content.includes(Buffer.from(env[key])))
      currentLeaks++;
}
console.log("Current secret matches in tracked contents:", currentLeaks);
if (currentLeaks) failure = true;
const objects = cp
  .execFileSync("git", ["rev-list", "--objects", "--all"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
let historyLeaks = 0;
for (const line of objects) {
  const [oid, ...rest] = line.split(" ");
  const file = rest.join(" ");
  if (!file || file.endsWith(".png") || file.endsWith(".jpg")) continue;
  try {
    const content = cp.execFileSync("git", ["cat-file", "blob", oid], {
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const key of secrets)
      if (env[key]?.length > 10 && content.includes(Buffer.from(env[key])))
        historyLeaks++;
    const s = content.toString();
    if (
      /(?:MODEL_API_KEY|SERPAPI_API_KEY|SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY)\s*=\s*["']?(?:sb_secret_[A-Za-z0-9_-]{10,}|[a-f0-9]{32,}|eyJ[A-Za-z0-9_-]{30,})/.test(
        s,
      )
    )
      historyLeaks++;
  } catch {
    /* Trees and large non-text objects are not printed. */
  }
}
console.log("Potential privileged secrets in Git history:", historyLeaks);
if (historyLeaks) {
  console.log(
    "WARNING: previously committed secrets may require rotation. History was not rewritten.",
  );
  failure = true;
}
const ignored = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.staging",
  "server/.env",
];
for (const file of ignored) {
  try {
    cp.execFileSync("git", ["check-ignore", "-q", file]);
    console.log(`${file}: ignored`);
  } catch {
    console.log(`${file}: NOT IGNORED`);
    failure = true;
  }
}
const unsafe = Object.keys(env).filter(
  (k) =>
    k.startsWith("EXPO_PUBLIC_") &&
    /MODEL_API|SERPAPI|SERVICE_ROLE|SECRET_KEY/.test(k),
);
console.log("Public-prefixed privileged variables:", unsafe.length);
if (unsafe.length) failure = true;
for (const file of [".env.example"]) {
  const values = parseEnv(fs.readFileSync(file, "utf8"));
  for (const key of secrets)
    if (values[key]) {
      console.log(`ERROR: ${file} has a non-placeholder privileged value.`);
      failure = true;
    }
}
if (failure) process.exitCode = 1;

for (const directory of [
  "dist",
  "dist-ios",
  ".private-cache/ios-export",
  ".private-cache/pivot-ios-export",
  ".private-cache/social-first-ios-export",
]) {
  if (!fs.existsSync(directory)) continue;
  let bundleLeaks = 0;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = require("node:path").join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(js|html|json|map|hbc)$/.test(file)) {
        const content = fs.readFileSync(file);
        for (const key of secrets)
          if (env[key]?.length > 10 && content.includes(Buffer.from(env[key])))
            bundleLeaks++;
      }
    }
  };
  visit(directory);
  console.log(`${directory} privileged secret matches:`, bundleLeaks);
  if (bundleLeaks) process.exitCode = 1;
}
