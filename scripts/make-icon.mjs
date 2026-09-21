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

function place(cx, cy, lx, ly, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)];
}

function makeRect(cx, cy, w, h, r, angle, color) {
  const a = (Math.abs(angle) * Math.PI) / 180;
  const ex = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
  const ey = Math.abs((w / 2) * Math.sin(a)) + Math.abs((h / 2) * Math.cos(a));
  return {
    type: "rect",
    cx,
    cy,
    w,
    h,
    r,
    angle,
    color,
    minX: cx - ex,
    maxX: cx + ex,
    minY: cy - ey,
    maxY: cy + ey,
  };
}

function makeCircle(cx, cy, r, color) {
  return {
    type: "circle",
    cx,
    cy,
    r,
    color,
    minX: cx - r,
    maxX: cx + r,
    minY: cy - r,
    maxY: cy + r,
  };
}

function makePoly(points, color) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { type: "poly", points, color, minX, maxX, minY, maxY };
}

const DESIGN = {
  size: 512,
  radius: 112,
  background: [
    [28, 33, 48],
    [10, 11, 15],
  ],
  page: [14, 15, 19],
  cream: [246, 239, 221],
  ink: [20, 22, 28],
  coral: [224, 104, 92],
  amber: [232, 182, 76],
};

const POPCORN_AMBER = [
  [126, 206, 28],
  [148, 230, 32],
  [194, 206, 40],
  [246, 198, 46],
  [298, 206, 40],
  [344, 230, 32],
  [368, 206, 28],
  [184, 260, 34],
  [236, 252, 38],
  [288, 252, 38],
  [332, 262, 30],
];

const POPCORN_CREAM = [
  [158, 218, 16],
  [204, 194, 19],
  [250, 186, 20],
  [302, 194, 19],
  [350, 218, 15],
  [174, 250, 14],
  [226, 242, 16],
  [276, 242, 16],
  [324, 252, 13],
];

const KERNEL_AMBER = [
  [96, 104, 18],
  [112, 96, 15],
  [108, 114, 13],
  [70, 150, 12],
  [82, 146, 10],
  [146, 56, 14],
  [160, 52, 12],
  [404, 126, 15],
  [418, 122, 13],
  [354, 448, 14],
  [368, 444, 12],
  [170, 470, 12],
  [182, 466, 10],
];

const KERNEL_CREAM = [
  [92, 98, 8],
  [106, 90, 7],
  [67, 146, 5],
  [142, 51, 6],
  [401, 121, 6],
  [351, 443, 6],
  [167, 465, 5],
];

const BUCKET = {
  topY: 250,
  bottomY: 466,
  topLeft: 128,
  topRight: 384,
  bottomLeft: 182,
  bottomRight: 330,
};

function ticketShapes(cx, cy, deg) {
  const rect = (lx, ly, w, h, r, color) => {
    const [ax, ay] = place(cx, cy, lx, ly, deg);
    return makeRect(ax, ay, w, h, r, deg, color);
  };
  return [
    rect(0, 0, 172, 78, 12, DESIGN.coral),
    rect(0, 0, 160, 66, 8, DESIGN.cream),
    rect(31.5, 0, 7, 66, 0, DESIGN.coral),
    rect(-26, -14.5, 64, 9, 4.5, DESIGN.ink),
    rect(-36, 2.5, 44, 9, 4.5, DESIGN.ink),
    rect(-23, 19.5, 70, 9, 4.5, DESIGN.ink),
  ];
}

function buildShapes() {
  const shapes = [...ticketShapes(210, 92, -30)];

  for (let i = 0; i < 8; i += 1) {
    const t0 = i / 8;
    const t1 = (i + 1) / 8;
    const top0 = BUCKET.topLeft + (BUCKET.topRight - BUCKET.topLeft) * t0;
    const top1 = BUCKET.topLeft + (BUCKET.topRight - BUCKET.topLeft) * t1;
    const bottom0 = BUCKET.bottomLeft + (BUCKET.bottomRight - BUCKET.bottomLeft) * t0;
    const bottom1 = BUCKET.bottomLeft + (BUCKET.bottomRight - BUCKET.bottomLeft) * t1;
    shapes.push(
      makePoly(
        [
          [top0, BUCKET.topY],
          [top1, BUCKET.topY],
          [bottom1, BUCKET.bottomY],
          [bottom0, BUCKET.bottomY],
        ],
        i % 2 === 0 ? DESIGN.coral : DESIGN.cream,
      ),
    );
  }

  for (const [cx, cy, r] of POPCORN_AMBER) shapes.push(makeCircle(cx, cy, r, DESIGN.amber));
  for (const [cx, cy, r] of POPCORN_CREAM) shapes.push(makeCircle(cx, cy, r, DESIGN.cream));

  shapes.push(...ticketShapes(262, 106, -9));

  for (const [cx, cy, r] of KERNEL_AMBER) shapes.push(makeCircle(cx, cy, r, DESIGN.amber));
  for (const [cx, cy, r] of KERNEL_CREAM) shapes.push(makeCircle(cx, cy, r, DESIGN.cream));

  return shapes;
}

function scaleShapes(shapes, scale) {
  return shapes.map((shape) => {
    if (shape.type === "circle") {
      return makeCircle(shape.cx * scale, shape.cy * scale, shape.r * scale, shape.color);
    }
    if (shape.type === "rect") {
      return makeRect(
        shape.cx * scale,
        shape.cy * scale,
        shape.w * scale,
        shape.h * scale,
        shape.r * scale,
        shape.angle,
        shape.color,
      );
    }
    return makePoly(
      shape.points.map(([x, y]) => [x * scale, y * scale]),
      shape.color,
    );
  });
}

function rectDistance(px, py, shape) {
  const a = (-shape.angle * Math.PI) / 180;
  const dx = px - shape.cx;
  const dy = py - shape.cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  const qx = Math.abs(lx) - (shape.w / 2 - shape.r);
  const qy = Math.abs(ly) - (shape.h / 2 - shape.r);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - shape.r;
}

const POLY_SAMPLES = 4;

function polyCoverage(px, py, points) {
  let hits = 0;
  for (let sy = 0; sy < POLY_SAMPLES; sy += 1) {
    const y = py + (sy + 0.5) / POLY_SAMPLES;
    for (let sx = 0; sx < POLY_SAMPLES; sx += 1) {
      const x = px + (sx + 0.5) / POLY_SAMPLES;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) hits += 1;
    }
  }
  return hits / (POLY_SAMPLES * POLY_SAMPLES);
}

function shapeCoverage(px, py, shape) {
  if (shape.type === "circle") return coverage(circleDistance(px, py, shape.cx, shape.cy, shape.r));
  if (shape.type === "rect") return coverage(rectDistance(px, py, shape));
  return polyCoverage(px, py, shape.points);
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / DESIGN.size;
  const [topColor, bottomColor] = DESIGN.background;
  const shapes = scaleShapes(buildShapes(), scale);

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

      for (const shape of shapes) {
        if (px < shape.minX || px > shape.maxX || py < shape.minY || py > shape.maxY) continue;
        const alpha = shapeCoverage(px, py, shape);
        if (alpha <= 0) continue;
        r = mix(r, shape.color[0], alpha);
        g = mix(g, shape.color[1], alpha);
        b = mix(b, shape.color[2], alpha);
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
