import { formatMinutes } from "@/lib/analytics";

export interface RecapImageData {
  year: string;
  movies: number;
  seasons: number;
  minutes: number;
  avg: number | null;
  top: { name: string; label: string; score: number | null; posterUrl: string | null }[];
  genres: string[];
  tasteLine: string | null;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 72;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 5000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let lineY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
  return lineY;
}

export async function renderRecapImage(data: RecapImageData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#181c26");
  gradient.addColorStop(1, "#0a0b0f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#9aa1b1";
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText("OUR YEAR IN WE SAW", PAD, 128);

  ctx.fillStyle = "#e8b64c";
  ctx.font = `700 188px ${FONT}`;
  ctx.fillText(data.year, PAD - 10, 300);

  const stats = [
    { value: String(data.movies), label: "MOVIES" },
    { value: String(data.seasons), label: "TV SEASONS" },
    { value: formatMinutes(data.minutes), label: "WATCHED" },
    { value: data.avg != null ? data.avg.toFixed(1) : "—", label: "AVG RATING" },
  ];
  const columnWidth = (WIDTH - PAD * 2) / stats.length;

  stats.forEach((stat, index) => {
    const x = PAD + index * columnWidth;
    ctx.fillStyle = "#e8eaf0";
    ctx.font = `700 54px ${FONT}`;
    ctx.fillText(stat.value, x, 430);
    ctx.fillStyle = "#9aa1b1";
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(stat.label, x, 470);
  });

  ctx.fillStyle = "#9aa1b1";
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("TOP OF THE YEAR", PAD, 560);

  const top = data.top.slice(0, 5);
  const posterWidth = 170;
  const posterHeight = 255;
  const gapWidth =
    top.length > 1 ? (WIDTH - PAD * 2 - posterWidth * top.length) / (top.length - 1) : 0;
  const images = await Promise.all(
    top.map((entry) => (entry.posterUrl ? loadImage(entry.posterUrl) : Promise.resolve(null))),
  );

  top.forEach((entry, index) => {
    const x = PAD + index * (posterWidth + gapWidth);
    const y = 610;
    const image = images[index];

    roundedPath(ctx, x, y, posterWidth, posterHeight, 16);
    ctx.save();
    ctx.clip();
    if (image) {
      drawCover(ctx, image, x, y, posterWidth, posterHeight);
    } else {
      ctx.fillStyle = "#1d2029";
      ctx.fillRect(x, y, posterWidth, posterHeight);
    }
    ctx.restore();

    ctx.fillStyle = "#e8eaf0";
    ctx.font = `600 22px ${FONT}`;
    const label = `${entry.name}${entry.label ? ` ${entry.label}` : ""}`;
    const labelY = wrapText(ctx, label, x, y + posterHeight + 38, posterWidth, 26);
    if (entry.score != null) {
      ctx.fillStyle = "#e8b64c";
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(String(entry.score), x, labelY + 44);
    }
  });

  let lineY = HEIGHT - 320;
  ctx.fillStyle = "#e8eaf0";
  ctx.font = `600 34px ${FONT}`;
  wrapText(
    ctx,
    `Top genres: ${data.genres.slice(0, 5).join(" · ")}`,
    PAD,
    lineY,
    WIDTH - PAD * 2,
    44,
  );

  if (data.tasteLine) {
    lineY += 120;
    ctx.fillStyle = "#9aa1b1";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(data.tasteLine, PAD, lineY);
  }

  ctx.fillStyle = "#e8b64c";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("we saw", PAD, HEIGHT - 96);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
