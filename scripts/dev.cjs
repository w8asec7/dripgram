const { spawn } = require("node:child_process");
const { readFileSync, existsSync } = require("node:fs");
const { parseEnv } = require("node:util");
const { lanNetworkSync } = require("lan-network");
const local = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
const host =
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME ||
  lanNetworkSync({ noDhcp: true }).address;
const backendPort = process.env.PORT || local.PORT || "3001";
const api =
  process.env.EXPO_PUBLIC_API_URL ||
  local.EXPO_PUBLIC_API_URL ||
  `http://${host}:${backendPort}`;
const env = {
  ...process.env,
  ALLOWED_WEB_ORIGINS:
    process.env.ALLOWED_WEB_ORIGINS ||
    local.ALLOWED_WEB_ORIGINS ||
    `http://${host}:8081,http://${host}:8082,http://localhost:8081,http://localhost:8082`,
};
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGINT");
}
async function healthy() {
  try {
    const r = await fetch(`http://127.0.0.1:${backendPort}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const j = await r.json();
    return (
      r.ok &&
      j.ok === true &&
      j.mode === "standard" &&
      typeof j.model === "string"
    );
  } catch {
    return false;
  }
}
async function main() {
  // Allow a running watch process to finish restarting instead of racing its port.
  let reuse = await healthy();
  if (!reuse) {
    await new Promise((r) => setTimeout(r, 500));
    reuse = await healthy();
  }
  if (reuse) console.log("Reusing the running Thread backend.");
  else {
    const backend = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts"],
      { stdio: "inherit", env },
    );
    children.push(backend);
    backend.on("error", () => {
      process.exitCode = 1;
      stop();
    });
    backend.on("exit", (code) => {
      if (code && !stopping) {
        process.exitCode = 1;
        stop();
      }
    });
    let ready = false;
    for (let i = 0; i < 30 && !stopping; i++) {
      if (await healthy()) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ready)
      throw new Error(
        "Backend did not become ready. Check the configured port.",
      );
  }
  console.log(`Phone backend URL: ${api}`);
  console.log(
    "Use the same Wi-Fi for phone and computer. Physical camera testing is for the user only.",
  );
  const expo = spawn(
    process.execPath,
    [
      require.resolve("expo/bin/cli"),
      "start",
      "--lan",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...env, EXPO_PUBLIC_API_URL: api } },
  );
  children.push(expo);
  expo.on("error", () => {
    process.exitCode = 1;
    stop();
  });
  expo.on("exit", (code) => {
    if (code) process.exitCode = code;
    stop();
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
  stop();
});
