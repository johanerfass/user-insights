#!/usr/bin/env node
// Tiny static file server for local preview of public/ — no dependencies.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "public");
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".ttf": "font/ttf",
};

createServer(async (req, res) => {
  try {
    const reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const filePath = path.join(ROOT, reqPath);
    if (!filePath.startsWith(ROOT)) throw new Error("path traversal blocked");
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}`));
