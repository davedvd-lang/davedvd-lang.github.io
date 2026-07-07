// Carátulas reales y búsqueda online.
//
// Sin configurar nada: TVmaze (series) e iTunes (películas) — APIs públicas sin
// clave y con CORS — resuelven las carátulas de tu biblioteca al abrir la app.
// Con una API key gratuita de TMDB (themoviedb.org) el buscador pasa además a
// ser online y global, con sinopsis en español.
// Todo se cachea en localStorage; sin conexión la app funciona igual con los
// pósteres de degradado.

const POSTER_CACHE = "butaca:posters:v1";
export const TMDB_KEY = "butaca:tmdb-key";

export const posterKey = (it) => `${it.type}:${it.title}`;

export function loadPosterCache() {
  try { return JSON.parse(localStorage.getItem(POSTER_CACHE)) || {}; } catch { return {}; }
}
function savePosterCache(cache) {
  try { localStorage.setItem(POSTER_CACHE, JSON.stringify(cache)); } catch { /* sin hueco */ }
}

export function loadTmdbKey() {
  try { return localStorage.getItem(TMDB_KEY) || ""; } catch { return ""; }
}
export function saveTmdbKey(key) {
  try { localStorage.setItem(TMDB_KEY, key); } catch { /* sin hueco */ }
}

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function posterFromTmdb(item, apiKey) {
  const kind = item.type === "series" ? "tv" : "movie";
  const q = new URLSearchParams({ api_key: apiKey, language: "es-ES", query: item.title });
  if (item.year && kind === "movie") q.set("year", item.year);
  const j = await getJSON(`https://api.themoviedb.org/3/search/${kind}?${q}`);
  const path = j.results?.[0]?.poster_path;
  return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

async function posterFromTvmaze(item) {
  const j = await getJSON(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(item.title)}`);
  return j?.image?.medium || null;
}

async function posterFromItunes(item) {
  const q = new URLSearchParams({ term: item.title, entity: "movie", country: "ES", limit: "3" });
  const j = await getJSON(`https://itunes.apple.com/search?${q}`);
  const hit =
    j.results?.find((r) => item.year && Math.abs(new Date(r.releaseDate).getFullYear() - item.year) <= 1) ||
    j.results?.[0];
  return hit?.artworkUrl100?.replace("100x100", "342x342") || null;
}

/** Resuelve carátulas que falten y va notificando con el cache actualizado. */
export async function enrichPosters(items, apiKey, onUpdate) {
  const cache = loadPosterCache();
  const missing = items.filter((it) => !it.img && !(posterKey(it) in cache));
  if (missing.length === 0) return;
  for (const it of missing) {
    try {
      let url = null;
      if (apiKey) url = await posterFromTmdb(it, apiKey);
      if (!url) url = it.type === "series" ? await posterFromTvmaze(it) : await posterFromItunes(it);
      cache[posterKey(it)] = url; // también null: «buscado, sin resultado»
      savePosterCache(cache);
      onUpdate({ ...cache });
    } catch {
      // Sin red o API caída: no cacheamos, se reintenta en la próxima apertura.
    }
  }
}

/* ---------- búsqueda online con TMDB (opcional, con API key) ---------- */

const mapTmdbResult = (r) => ({
  tmdbId: r.id,
  type: r.media_type === "tv" ? "series" : "movie",
  title: r.media_type === "tv" ? r.name : r.title,
  year: parseInt((r.first_air_date || r.release_date || "").slice(0, 4)) || "",
  genre: r.media_type === "tv" ? "Serie · TMDB" : "Película · TMDB",
  synopsis: r.overview || "",
  released: r.first_air_date || r.release_date || undefined,
  img: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : undefined,
  poster: { from: "#3b4863", to: "#0b0e16", emoji: r.media_type === "tv" ? "📺" : "🎬" },
});

export async function searchTmdb(query, apiKey) {
  const q = new URLSearchParams({ api_key: apiKey, language: "es-ES", query, include_adult: "false" });
  const j = await getJSON(`https://api.themoviedb.org/3/search/multi?${q}`);
  return (j.results || [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 12)
    .map(mapTmdbResult);
}

/** Candidatos para «Descubrir»: lo más visto de la semana en TMDB. */
export async function fetchTrending(apiKey, page = 1) {
  const q = new URLSearchParams({ api_key: apiKey, language: "es-ES", page: String(page) });
  const j = await getJSON(`https://api.themoviedb.org/3/trending/all/week?${q}`);
  return (j.results || [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map(mapTmdbResult);
}

/** Completa un resultado de TMDB antes de añadirlo: temporadas/duración y géneros reales. */
export async function hydrateTmdbItem(result, apiKey) {
  const q = new URLSearchParams({ api_key: apiKey, language: "es-ES" });
  if (result.type === "series") {
    const j = await getJSON(`https://api.themoviedb.org/3/tv/${result.tmdbId}?${q}`);
    const seasons = (j.seasons || [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({ eps: s.episode_count, watched: 0 }));
    const genre = (j.genres || []).slice(0, 2).map((g) => g.name).join(" · ");
    return { ...result, genre: genre || result.genre, seasons: seasons.length ? seasons : [{ eps: 8, watched: 0 }] };
  }
  const j = await getJSON(`https://api.themoviedb.org/3/movie/${result.tmdbId}?${q}`);
  const genre = (j.genres || []).slice(0, 2).map((g) => g.name).join(" · ");
  return { ...result, genre: genre || result.genre, runtime: j.runtime || undefined };
}

/* ---------- aviso de nueva temporada (series en pausa / en curso) ---------- */

const TVCHECK = "butaca:tvcheck:v1";

/** Comprueba en TMDB (máx. una vez al día por serie) si hay episodios nuevos.
    Llama a onFound(posterKey, [eps por temporada]) por cada serie con novedades. */
export async function checkSeasonUpdates(items, apiKey, onFound) {
  if (!apiKey) return;
  let cache;
  try { cache = JSON.parse(localStorage.getItem(TVCHECK)) || {}; } catch { cache = {}; }
  const now = Date.now();
  for (const it of items) {
    if (it.type !== "series" || !it.tmdbId) continue;
    if (!["paused", "watching", "watchlist"].includes(it.status)) continue;
    const k = posterKey(it);
    let entry = cache[k];
    if (!entry || now - entry.ts > 864e5) {
      try {
        const q = new URLSearchParams({ api_key: apiKey, language: "es-ES" });
        const j = await getJSON(`https://api.themoviedb.org/3/tv/${it.tmdbId}?${q}`);
        entry = {
          ts: now,
          seasons: (j.seasons || [])
            .filter((s) => s.season_number > 0 && s.episode_count > 0)
            .map((s) => s.episode_count),
        };
        cache[k] = entry;
        try { localStorage.setItem(TVCHECK, JSON.stringify(cache)); } catch { /* sin hueco */ }
      } catch { continue; /* sin red: se reintenta otro día */ }
    }
    const localTotal = it.seasons.reduce((n, s) => n + s.eps, 0);
    const remoteTotal = entry.seasons.reduce((n, e) => n + e, 0);
    if (remoteTotal > localTotal) onFound(k, entry.seasons);
  }
}
