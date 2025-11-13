#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const repoRoot = path.resolve(__dirname, "..");
const imagesDir = path.join(repoRoot, "assets", "images");
const manifestPath = path.join(imagesDir, "manifest.json");
const allowedExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".gif",
  ".webp",
  ".avif",
]);

function collectImageFiles() {
  const discoveredFiles = [];

  function walk(currentDir, relativePath = "") {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error(`Unable to read images directory at ${currentDir}`);
      throw error;
    }

    for (const entry of entries) {
      if (entry.name === "manifest.json") {
        continue;
      }

      const entryRelativePath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;
      const entryAbsolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(entryAbsolutePath, entryRelativePath);
        continue;
      }

      if (
        entry.isFile() &&
        allowedExtensions.has(path.extname(entry.name).toLowerCase())
      ) {
        discoveredFiles.push(entryRelativePath.replace(/\\/g, "/"));
      }
    }
  }

  walk(imagesDir);

  return discoveredFiles.sort((a, b) => a.localeCompare(b, "en"));
}

function createManifest(images) {
  const hash = crypto
    .createHash("sha1")
    .update(images.join("|"))
    .digest("hex");

  return {
    generatedAt: new Date().toISOString(),
    version: hash,
    images,
  };
}

function writeManifest(manifest) {
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath, content, "utf8");
}

function run() {
  const images = collectImageFiles();
  const manifest = createManifest(images);
  writeManifest(manifest);
  console.log(
    `Generated manifest with ${images.length} image${images.length === 1 ? "" : "s"}.`
  );
}

run();
