import { handleCatalog } from "../server/catalog.js";

export default async function handler(request, response) {
  const result = await handleCatalog({
    query: request.query ?? {},
    env: {
      TMDB_API_KEY: process.env.TMDB_API_KEY,
      OMDB_API_KEY: process.env.OMDB_API_KEY,
    },
    origin: request.headers.origin ?? null,
    referer: request.headers.referer ?? null,
    host: request.headers.host ?? null,
    secFetchSite: request.headers["sec-fetch-site"] ?? null,
  });
  response.setHeader("Cache-Control", result.cacheControl);
  response.status(result.status).json(result.body);
}
