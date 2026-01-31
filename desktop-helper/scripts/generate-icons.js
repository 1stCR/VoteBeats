/**
 * Generate a 256x256 PNG icon for VoteBeats Desktop Helper.
 * This creates a simple but recognizable icon with a music note
 * in VoteBeats brand colors (indigo/purple gradient).
 *
 * electron-builder will auto-convert the PNG to:
 * - .ico (Windows)
 * - .icns (macOS)
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

const SIZE = 256;

// Create a raw RGBA buffer
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius) {
        const aa = dist > radius - 1 ? Math.round(a * (radius - dist)) : a;
        setPixel(x, y, r, g, b, aa);
      }
    }
  }
}

function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = Math.max(0, Math.floor(y1)); y < Math.min(SIZE, Math.ceil(y2)); y++) {
    for (let x = Math.max(0, Math.floor(x1)); x < Math.min(SIZE, Math.ceil(x2)); x++) {
      setPixel(x, y, r, g, b, a);
    }
  }
}

// Background - rounded rectangle with gradient
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cornerRadius = 48;
    const margin = 4;

    // Check if inside rounded rectangle
    let inside = false;
    if (x >= margin && x < SIZE - margin && y >= margin && y < SIZE - margin) {
      // Check corners
      const corners = [
        [margin + cornerRadius, margin + cornerRadius],
        [SIZE - margin - cornerRadius, margin + cornerRadius],
        [margin + cornerRadius, SIZE - margin - cornerRadius],
        [SIZE - margin - cornerRadius, SIZE - margin - cornerRadius]
      ];

      inside = true;
      if (x < margin + cornerRadius && y < margin + cornerRadius) {
        inside = Math.sqrt((x - corners[0][0]) ** 2 + (y - corners[0][1]) ** 2) <= cornerRadius;
      } else if (x >= SIZE - margin - cornerRadius && y < margin + cornerRadius) {
        inside = Math.sqrt((x - corners[1][0]) ** 2 + (y - corners[1][1]) ** 2) <= cornerRadius;
      } else if (x < margin + cornerRadius && y >= SIZE - margin - cornerRadius) {
        inside = Math.sqrt((x - corners[2][0]) ** 2 + (y - corners[2][1]) ** 2) <= cornerRadius;
      } else if (x >= SIZE - margin - cornerRadius && y >= SIZE - margin - cornerRadius) {
        inside = Math.sqrt((x - corners[3][0]) ** 2 + (y - corners[3][1]) ** 2) <= cornerRadius;
      }
    }

    if (inside) {
      // Gradient from top-left (indigo) to bottom-right (purple)
      const t = (x + y) / (2 * SIZE);
      const r = Math.round(30 + t * 60);   // 30 -> 90
      const g = Math.round(27 + t * 10);   // 27 -> 37
      const b = Math.round(75 + t * 90);   // 75 -> 165
      setPixel(x, y, r, g, b, 255);
    }
  }
}

// Draw a music note symbol (simplified 8th note) in white
const noteColor = [255, 255, 255];

// Note head (filled ellipse/circle) - bottom left
fillCircle(95, 175, 22, ...noteColor);

// Stem (vertical line from note head going up)
fillRect(115, 60, 122, 175, ...noteColor);

// Flag (curved line from top of stem going right)
for (let i = 0; i < 50; i++) {
  const t = i / 50;
  const x = 122 + t * 40;
  const y = 60 + t * 35 + Math.sin(t * Math.PI) * 15;
  fillCircle(x, y, 5, ...noteColor);
}

// Second smaller note head (for beamed 8th note pair)
fillCircle(160, 115, 18, ...noteColor);
fillRect(176, 60, 183, 115, ...noteColor);

// Beam connecting the two stems
fillRect(115, 56, 183, 66, ...noteColor);

// "VB" text indicator (small, at bottom)
// V shape
for (let i = 0; i < 16; i++) {
  const t = i / 16;
  fillRect(88 + t * 12, 210 + t * 20, 91 + t * 12, 213 + t * 20, ...noteColor);
  fillRect(112 - t * 12, 210 + t * 20, 115 - t * 12, 213 + t * 20, ...noteColor);
}

// Encode as PNG
function createPNG(width, height, rgbaData) {
  // Simple PNG encoder (uncompressed)
  const zlib = require('zlib');

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk - raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = rgbaData[srcIdx];
      rawData[dstIdx + 1] = rgbaData[srcIdx + 1];
      rawData[dstIdx + 2] = rgbaData[srcIdx + 2];
      rawData[dstIdx + 3] = rgbaData[srcIdx + 3];
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate and save
const pngBuffer = createPNG(SIZE, SIZE, pixels);
const outputPath = path.join(__dirname, '..', 'assets', 'icon.png');

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(outputPath, pngBuffer);
console.log(`Icon generated: ${outputPath} (${pngBuffer.length} bytes)`);
console.log('Note: electron-builder will auto-convert PNG to .ico and .icns during build');
