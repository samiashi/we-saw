export interface CatalogRequest {
  query?: Record<string, unknown>;
  env?: {
    TMDB_API_KEY?: string | undefined;
    OMDB_API_KEY?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
    VITE_SUPABASE_URL?: string | undefined;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
    VITE_SUPABASE_ANON_KEY?: string | undefined;
  };
  method?: string;
  authorization?: string | null;
  body?: unknown;
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
  secFetchSite?: string | null;
}

export interface CatalogResult {
  status: number;
  body: unknown;
  cacheControl: string;
}

export function handleCatalog(request?: CatalogRequest): Promise<CatalogResult>;
