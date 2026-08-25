import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

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

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const item of publishItems) copyItem(item, join(output, item));
