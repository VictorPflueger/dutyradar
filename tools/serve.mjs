// A dependency-free static server for the site: npm run serve, then open http://localhost:8080.
// Browsers do not load the app's modules and data files from a file:// page, so the offline fallback
// is this server on the presenter's laptop. Usage: node tools/serve.mjs [port]
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};
const port = Number(process.argv[2] || process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT + path.sep) || /[\\/](?:node_modules|\.git)[\\/]/.test(file)) { res.writeHead(403); res.end("forbidden"); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Duty Radar at http://localhost:${port}/ (Ctrl+C stops)`));
