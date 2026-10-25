/** Local static SPA preview of dist. Never serves source files or environment files. */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve("dist"),
  port = Number(process.env.DRIPGRAM_PREVIEW_PORT || 8082);
if (!fs.existsSync(path.join(root, "index.html")))
  throw new Error("Run npm run export first.");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
http
  .createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let target = path.resolve(root, "." + decoded);
    if (!target.startsWith(root + path.sep) && target !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      if (decoded.startsWith("/assets/") || decoded.startsWith("/_expo/")) {
        res.writeHead(404);
        res.end();
        return;
      }
      target = path.join(root, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(target).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Local exported web preview: http://localhost:${port} (not a public deployment)`,
    ),
  );
