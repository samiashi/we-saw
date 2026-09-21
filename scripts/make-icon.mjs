import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function coverage(distance) {
  return clamp01(0.5 - distance);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function roundedRectDistance(x, y, size, radius) {
  const half = size / 2;
  const qx = Math.abs(x - half) - half + radius;
  const qy = Math.abs(y - half) - half + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

function circleDistance(x, y, cx, cy, radius) {
  return Math.hypot(x - cx, y - cy) - radius;
}

const DESIGN = {
  size: 512,
  radius: 112,
  background: [
    [28, 33, 48],
    [10, 11, 15],
  ],
  page: [14, 15, 19],
  sclera: [246, 239, 221],
  pupil: [20, 22, 28],
  highlight: { offsetX: 6, offsetY: -7, r: 6, color: [246, 239, 221] },
  eyes: [
    {
      cx: 174,
      cy: 264,
      r: 80,
      iris: [232, 182, 76],
      irisCx: 184,
      irisCy: 258,
      irisR: 37,
      pupilR: 17,
    },
    {
      cx: 338,
      cy: 264,
      r: 80,
      iris: [224, 104, 92],
      irisCx: 328,
      irisCy: 258,
      irisR: 37,
      pupilR: 17,
    },
  ],
};

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / DESIGN.size;
  const [topColor, bottomColor] = DESIGN.background;

  const eyes = DESIGN.eyes.map((eye) => ({
    cx: eye.cx * scale,
    cy: eye.cy * scale,
    r: eye.r * scale,
    iris: eye.iris,
    irisCx: eye.irisCx * scale,
    irisCy: eye.irisCy * scale,
    irisR: eye.irisR * scale,
    pupilR: eye.pupilR * scale,
  }));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;

      let r = DESIGN.page[0];
      let g = DESIGN.page[1];
      let b = DESIGN.page[2];

      const tile = coverage(roundedRectDistance(px, py, size, DESIGN.radius * scale));
      if (tile > 0) {
        const t = (px + py) / (2 * size);
        r = mix(r, mix(topColor[0], bottomColor[0], t), tile);
        g = mix(g, mix(topColor[1], bottomColor[1], t), tile);
        b = mix(b, mix(topColor[2], bottomColor[2], t), tile);
      }

      const layers = [];
      for (const eye of eyes) {
        layers.push(
          { distance: circleDistance(px, py, eye.cx, eye.cy, eye.r), color: DESIGN.sclera },
          { distance: circleDistance(px, py, eye.irisCx, eye.irisCy, eye.irisR), color: eye.iris },
          {
            distance: circleDistance(px, py, eye.irisCx, eye.irisCy, eye.pupilR),
            color: DESIGN.pupil,
          },
          {
            distance: circleDistance(
              px,
              py,
              eye.irisCx + DESIGN.highlight.offsetX * scale,
              eye.irisCy + DESIGN.highlight.offsetY * scale,
              DESIGN.highlight.r * scale,
            ),
            color: DESIGN.highlight.color,
          },
        );
      }

      for (const layer of layers) {
        const alpha = coverage(layer.distance);
        if (alpha <= 0) continue;
        r = mix(r, layer.color[0], alpha);
        g = mix(g, layer.color[1], alpha);
        b = mix(b, layer.color[2], alpha);
      }

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r);
      pixels[offset + 1] = Math.round(g);
      pixels[offset + 2] = Math.round(b);
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(root, { recursive: true });

for (const [size, name] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
]) {
  writeFileSync(join(root, name), render(size));
  console.log(`wrote public/${name}`);
}
