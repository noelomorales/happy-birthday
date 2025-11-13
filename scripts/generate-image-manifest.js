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

function readImageDirectory() {
  try {
    return fs.readdirSync(imagesDir, { withFileTypes: true });
  } catch (error) {
    console.error(`Unable to read images directory at ${imagesDir}`);
    throw error;
  }
}

function collectImageFiles() {
  return readImageDirectory()
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== "manifest.json")
    .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "en"));
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
