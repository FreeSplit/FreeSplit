/*
  Icon generator: uses your existing SVG as the single source of truth
  - Reads: ../src/images/FreeSplit-S-Logo.svg (do not open images here; this script just references paths)
  - Writes PNG icons into this public/ folder: favicon-16.png, favicon-32.png, icon-192.png, icon-512.png, icon-192-maskable.png, icon-512-maskable.png, apple-touch-icon.png
  - Also copies the SVG to public/icon.svg for browsers that support it.

  Usage:
    npm run icons

  Requires:
    npm i -D sharp
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_SVG = path.join(__dirname, '..', 'src', 'images', 'FreeSplit-S-Logo.svg');
const OUT_DIR = __dirname; // public/

async function ensureSourceExists() {
  if (!fs.existsSync(SRC_SVG)) {
    throw new Error(`Source SVG not found at: ${SRC_SVG}`);
  }
}

async function copySvg() {
  const dest = path.join(OUT_DIR, 'icon.svg');
  fs.copyFileSync(SRC_SVG, dest);
}

async function createPng(size, outFile, paddingRatio = 0, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const contentSize = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
  const resized = await sharp(SRC_SVG)
    .resize(contentSize, contentSize, { fit: 'contain', background })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background
    }
  });

  const left = Math.round((size - contentSize) / 2);
  const top = Math.round((size - contentSize) / 2);

  await canvas
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(path.join(OUT_DIR, outFile));
}

async function run() {
  await ensureSourceExists();

  // Copy raw SVG for manifest fallback
  await copySvg();

  // Standard icons (transparent background)
  await createPng(16, 'favicon-16.png', 0);
  await createPng(32, 'favicon-32.png', 0);
  await createPng(192, 'icon-192.png', 0);
  await createPng(512, 'icon-512.png', 0);

  // Maskable icons (add safe padding ~12%)
  await createPng(192, 'icon-192-maskable.png', 0.12);
  await createPng(512, 'icon-512-maskable.png', 0.12);

  // Apple touch icon (solid background recommended)
  await createPng(180, 'apple-touch-icon.png', 0.08, { r: 255, g: 255, b: 255, alpha: 1 });
  await createPng(180, 'apple-touch-icon-180x180.png', 0.08, { r: 255, g: 255, b: 255, alpha: 1 });
  await createPng(167, 'apple-touch-icon-167x167.png', 0.08, { r: 255, g: 255, b: 255, alpha: 1 });
  await createPng(152, 'apple-touch-icon-152x152.png', 0.08, { r: 255, g: 255, b: 255, alpha: 1 });
  await createPng(120, 'apple-touch-icon-120x120.png', 0.08, { r: 255, g: 255, b: 255, alpha: 1 });

  console.log('Icons generated in public/:');
  console.log('- favicon-16.png, favicon-32.png');
  console.log('- icon-192.png, icon-512.png');
  console.log('- icon-192-maskable.png, icon-512-maskable.png');
  console.log('- apple-touch-icon.png, apple-touch-icon-180x180.png');
  console.log('- apple-touch-icon-167x167.png, apple-touch-icon-152x152.png, apple-touch-icon-120x120.png');
  console.log('- icon.svg');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
