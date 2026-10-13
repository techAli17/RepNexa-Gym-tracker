#!/usr/bin/env node
/**
 * Draws the RepNexa app icon (a weight plate on amber) and writes every size
 * iOS and Android need. Pure Node: geometry with 4×4 supersampling, PNG via zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const AMBER = [0xf2, 0xa9, 0x3b];
const INK = [0x24, 0x16, 0x00];

/** Colour at a point in unit space (0..1), or null for transparent. */
function sample(x, y, { round, logo = false, zoom = 1 }) {
  // `logo`: the plate alone on transparent, for launch screens; `zoom` scales it up.
  const cx = (x - 0.5) / zoom;
  const cy = (y - 0.5) / zoom;
  const r = Math.hypot(cx, cy);
  if (round && r > 0.5) return null;
  // Plate: outer rim, a groove, the face, then the hub with its bar hole.
  if (r <= 0.335 && r >= 0.255) return INK; // rim
  if (r <= 0.215 && r >= 0.195) return INK; // groove ring
  if (r <= 0.085 && r >= 0.04) return INK; // hub
  // Three grip slots in the face, like a real plate.
  if (r > 0.12 && r < 0.17) {
    const a = Math.atan2(cy, cx);
    for (let k = 0; k < 3; k++) {
      const c = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
      let d = Math.abs(a - c);
      d = Math.min(d, 2 * Math.PI - d);
      if (d < 0.32) return INK;
    }
  }
  return logo ? null : AMBER;
}

function render(size, opts) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      px[i] = a ? Math.round(r / a) : 0;
      px[i + 1] = a ? Math.round(g / a) : 0;
      px[i + 2] = a ? Math.round(b / a) : 0;
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, size, px, opts.opaque);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** RGBA → PNG. `opaque` drops alpha (App Store icons must not have transparency). */
function encodePng(w, h, rgba, opaque) {
  const ch = opaque ? 3 : 4;
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * ch + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (w * ch + 1) + 1 + x * ch;
      raw[d] = rgba[s];
      raw[d + 1] = rgba[s + 1];
      raw[d + 2] = rgba[s + 2];
      if (!opaque) raw[d + 3] = rgba[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(rel, buf) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

// iOS: one opaque square per slot; the system applies the rounded mask.
const IOS_DIR = 'ios/RepNexa/Images.xcassets/AppIcon.appiconset';
const iosSlots = [
  ['iphone', 20, 2], ['iphone', 20, 3], ['iphone', 29, 2], ['iphone', 29, 3],
  ['iphone', 40, 2], ['iphone', 40, 3], ['iphone', 60, 2], ['iphone', 60, 3],
  ['ios-marketing', 1024, 1],
];
const images = [];
const cache = new Map();
for (const [idiom, pt, scale] of iosSlots) {
  const px = pt * scale;
  const file = `icon-${px}.png`;
  if (!cache.has(px)) {
    cache.set(px, true);
    write(join(IOS_DIR, file), render(px, { round: false, opaque: true }));
  }
  images.push({ filename: file, idiom, scale: `${scale}x`, size: `${pt}x${pt}` });
}
write(join(IOS_DIR, 'Contents.json'), Buffer.from(JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n'));

// Android legacy launcher icons: square and round, per density.
for (const [dir, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  write(`android/app/src/main/res/mipmap-${dir}/ic_launcher.png`, render(px, { round: false }));
  write(`android/app/src/main/res/mipmap-${dir}/ic_launcher_round.png`, render(px, { round: true }));
}

// Android 8+ adaptive icon: the plate on a 108dp transparent foreground over an amber
// colour background. Without this, launchers box the legacy PNG in a white circle.
// The plate stays inside the 66dp safe zone; the same layer doubles as the themed-icon mask.
for (const [dir, f] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  write(`android/app/src/main/res/mipmap-${dir}/ic_launcher_foreground.png`, render(Math.round(108 * f), { logo: true, zoom: 0.72 }));
}
const adaptive = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`);
write('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive);
write('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', adaptive);

// Launch screens: the plate alone (ink on transparent) over an amber background.
// iOS image set, 120pt.
const SPLASH_DIR = 'ios/RepNexa/Images.xcassets/SplashLogo.imageset';
const splashImages = [];
for (const scale of [1, 2, 3]) {
  const file = `splash-logo@${scale}x.png`;
  write(join(SPLASH_DIR, file), render(120 * scale, { logo: true, zoom: 1.45 }));
  splashImages.push({ filename: file, idiom: 'universal', scale: `${scale}x` });
}
write(join(SPLASH_DIR, 'Contents.json'), Buffer.from(JSON.stringify({ images: splashImages, info: { author: 'xcode', version: 1 } }, null, 2) + '\n'));
// Android: 288dp canvas (the Android 12+ splash icon size, masked to the inner 192dp circle).
for (const [dir, f] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  write(`android/app/src/main/res/drawable-${dir}/splash_logo.png`, render(Math.round(288 * f), { logo: true, zoom: 0.95 }));
}

console.log('Icons written.');
