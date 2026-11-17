/** Read a bounded JSON body from Vercel's parsed request or a Node stream. */
export async function readJsonBody(request) {
  const limit = 8192;
  if (Number(request.headers?.["content-length"] ?? 0) > limit) throw new Error("Body too large");
  if (request.body !== undefined) {
    const raw = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(raw) > limit) throw new Error("Body too large");
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw new Error("Body too large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
