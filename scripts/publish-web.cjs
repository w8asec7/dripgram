/** Explicit release command. Static Firebase Hosting only; does not enable billing. */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
async function main() {
  const base =
    process.argv[2] ||
    JSON.parse(fs.readFileSync(".private-cache/public-backend.json", "utf8"))
      .url;
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.pathname !== "/"
  )
    throw Error(
      "Use the actual HTTPS backend origin without credentials/path/query.",
    );
  const response = await fetch(url.origin + "/health", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw Error(
      "Backend tunnel is not reachable; start npm run host:backend first.",
    );
  for (const [command, args] of [
    ["npm", ["run", "export"]],
    ["npm", ["run", "qa:security"]],
    [
      "npx",
      [
        "firebase",
        "deploy",
        "--only",
        "hosting",
        "--project",
        "thread-hacktx-2026-rp",
      ],
    ],
  ]) {
    const result = spawnSync(command, args, {
      stdio: "inherit",
      env: { ...process.env, EXPO_PUBLIC_API_URL: url.origin },
    });
    if (result.status !== 0)
      throw Error(
        "Release stopped because a build, security check, or deployment failed.",
      );
  }
  console.info(
    "Published https://thread-hacktx-2026-rp.web.app; custom domain requires verified registrar DNS.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
