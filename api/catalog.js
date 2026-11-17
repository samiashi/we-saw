import { handleCatalog } from "../server/catalog.js";
import { readJsonBody } from "../server/readJsonBody.js";

export const maxDuration = 60;

export default async function handler(request, response) {
  let body = null;
  if (request.query?.action === "tonight" && request.method === "POST") {
    try {
      body = await readJsonBody(request);
    } catch {
      response.setHeader("Cache-Control", "private, no-store");
      return response.status(400).json({ error: "invalid_body" });
    }
  }
  const result = await handleCatalog({
    query: request.query ?? {},
    env: {
      TMDB_API_KEY: process.env.TMDB_API_KEY,
      OMDB_API_KEY: process.env.OMDB_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
    body,
    method: request.method,
    authorization: request.headers.authorization ?? null,
    origin: request.headers.origin ?? null,
    referer: request.headers.referer ?? null,
    host: request.headers.host ?? null,
    secFetchSite: request.headers["sec-fetch-site"] ?? null,
  });
  response.setHeader("Cache-Control", result.cacheControl);
  response.setHeader("Vary", "Origin, Referer, Sec-Fetch-Site, Authorization");
  response.status(result.status).json(result.body);
}
