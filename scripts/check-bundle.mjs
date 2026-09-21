import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = "dist/assets";
const SHELL_LIMIT = 220 * 1024;
const CHUNK_LIMIT = 130 * 1024;
const CSS_LIMIT = 20 * 1024;

const files = readdirSync(dist).filter((file) => file.endsWith(".js") || file.endsWith(".css"));
const shellPrefixes = ["index-", "react-", "supabase-"];

let shell = 0;
let failed = false;
const rows = [];

for (const file of files) {
  const gzip = gzipSync(readFileSync(join(dist, file))).length;
  const isCss = file.endsWith(".css");
  const isShell = shellPrefixes.some((prefix) => file.startsWith(prefix));
  const limit = isCss ? CSS_LIMIT : isShell ? Number.POSITIVE_INFINITY : CHUNK_LIMIT;

  if (isShell) shell += gzip;

  const ok = gzip <= limit;
  if (!ok) failed = true;
  rows.push({
    file,
    kb: (gzip / 1024).toFixed(1),
    limit: Number.isFinite(limit) ? `${(limit / 1024).toFixed(0)}kb` : "shell pool",
    ok,
  });
}

rows.sort((a, b) => Number(b.kb) - Number(a.kb));
for (const row of rows) {
  console.log(
    `${row.ok ? "ok  " : "FAIL"} ${row.file.padEnd(42)} ${row.kb.padStart(7)}kb (${row.limit})`,
  );
}

console.log(
  `shell total: ${(shell / 1024).toFixed(1)}kb (limit ${(SHELL_LIMIT / 1024).toFixed(0)}kb)`,
);
if (shell > SHELL_LIMIT) failed = true;

if (failed) {
  console.error("Bundle budget exceeded.");
  process.exit(1);
}
