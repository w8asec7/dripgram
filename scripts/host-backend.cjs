/** Laptop-hosted HTTPS backend. No account, billing, or secret-bearing tunnel flags. */
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { setTimeout: pause } = require("node:timers/promises");
const state = ".private-cache/public-backend.json";
const local = "http://127.0.0.1:3001";
const children = [];
const healthy = async (url) => {
  try {
    return (await fetch(url + "/health", { signal: AbortSignal.timeout(4000) }))
      .ok;
  } catch {
    return false;
  }
};
function stop(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
async function main() {
  fs.mkdirSync(".private-cache", { recursive: true });
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(state, "utf8"));
  } catch {
    /* First run. */
  }
  if (saved?.url && (await healthy(saved.url))) {
    console.info(
      `Existing public backend is healthy: ${saved.url}\nKeep its existing backend/tunnel terminals open.`,
    );
    return;
  }
  if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0)
    throw Error(
      "Install the free cloudflared CLI first: brew install cloudflared",
    );
  if (!(await healthy(local))) {
    const backend = spawn("npm", ["run", "backend"], { stdio: "inherit" });
    children.push(backend);
    backend.on("exit", (code) => {
      if (code) stop(code);
    });
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (await healthy(local)) {
        ready = true;
        break;
      }
      await pause(500);
    }
    if (!ready)
      throw Error(
        "Backend did not start on port3001. Inspect the backend error.",
      );
  }
  if (process.platform === "darwin") {
    const awake = spawn("caffeinate", ["-i"], { stdio: "ignore" });
    awake.on("error", () => {});
    children.push(awake);
  }
  const tunnel = spawn(
    "cloudflared",
    ["tunnel", "--url", local, "--protocol", "http2", "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(tunnel);
  let published = false;
  const consume = (data) => {
    const match = String(data).match(
      /https:\/\/[a-z0-9-]+\.trycloudflare\.com/,
    );
    if (match && !published) {
      published = true;
      fs.writeFileSync(
        state,
        JSON.stringify(
          { url: match[0], createdAt: new Date().toISOString(), port: 3001 },
          null,
          2,
        ) + "\n",
        { mode: 0o600 },
      );
      console.info(
        `Public backend: ${match[0]}\nKeep this terminal and laptop running. Then run npm run publish:web to build and update the website with this URL.`,
      );
    }
  };
  tunnel.stdout.on("data", consume);
  tunnel.stderr.on("data", consume);
  tunnel.on("error", () => {
    console.error("Could not start cloudflared.");
    stop(1);
  });
  tunnel.on("exit", (code) => {
    console.info("Public backend tunnel stopped.");
    stop(code || 0);
  });
  process.on("SIGINT", () => stop());
  process.on("SIGTERM", () => stop());
}
main().catch((error) => {
  console.error(error.message);
  stop(1);
});
