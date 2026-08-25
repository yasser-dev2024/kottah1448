import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";

const output = "dist";
const publishItems = [
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "plan-data.json",
  "assets",
  ".nojekyll",
  ".openai",
];

function copyItem(source, destination) {
  if (!existsSync(source)) return;
  if (statSync(source).isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyItem(join(source, entry), join(destination, entry));
    }
    return;
  }
  mkdirSync(join(destination, ".."), { recursive: true });
  copyFileSync(source, destination);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function collectRuntimeFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const outputPath = relative(output, fullPath).split(sep).join("/");
    if (outputPath === "index.js" || outputPath === ".nojekyll" || outputPath.startsWith(".openai/")) continue;
    if (statSync(fullPath).isDirectory()) collectRuntimeFiles(fullPath, files);
    else files.push({
      path: outputPath,
      type: mimeTypes[extname(entry).toLowerCase()] || "application/octet-stream",
      body: readFileSync(fullPath).toString("base64"),
    });
  }
  return files;
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const item of publishItems) copyItem(item, join(output, item));

const assetMap = Object.fromEntries(
  collectRuntimeFiles(output).map(({ path, type, body }) => [path, { type, body }]),
);
const workerTemplate = readFileSync("worker.mjs", "utf8");
writeFileSync(
  join(output, "index.js"),
  workerTemplate.replace("__SITE_ASSETS__", JSON.stringify(assetMap)),
);
