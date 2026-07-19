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

// con año: dos pelis pueden compartir título (remakes tipo «Desafío total»)
export const posterKey = (it) => `${it.type}:${it.title}:${it.year || ""}`;

export function loadPosterCache() {
  try { return JSON.parse(localStorage.getItem(POSTER_CACHE)) || {}; } catch { return {}; }
}
function savePosterCache(cache) {
  try { localStorage.setItem(POSTER_CACHE, JSON.stringify(cache)); } catch { /* sin hueco */ }
}

// Clave integrada en el build (APK de la tienda): la app funciona sin configurar
// nada; si el usuario guarda la suya en Stats, la suya manda.
const BUILT_IN_KEY = typeof __BUTACA_TMDB_KEY__ !== "undefined" ? __BUTACA_TMDB_KEY__ : "";

export function loadTmdbKey() {
  try { return localStorage.getItem(TMDB_KEY) || BUILT_IN_KEY; } catch { return BUILT_IN_KEY; }
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
  tmdbRating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined, // nota media de TMDB (0–10)
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

/** Joyas de otras décadas para intercalar en «Descubrir»: pelis populares de
    TRES épocas distintas al azar, en rueda — dos clásicas seguidas nunca son de
    la misma década (mínimo de votos para no sacar morralla). */
const ERAS = [[1950, 1969], [1970, 1979], [1980, 1989], [1990, 1999], [2000, 2009], [2010, 2019]];

export async function fetchClassics(apiKey, page = 1) {
  const eras = [...ERAS].sort(() => Math.random() - 0.5).slice(0, 3);
  const batches = await Promise.all(eras.map(async ([from, to]) => {
    try {
      const q = new URLSearchParams({
        api_key: apiKey, language: "es-ES", sort_by: "popularity.desc", include_adult: "false",
        "primary_release_date.gte": `${from}-01-01`, "primary_release_date.lte": `${to}-12-31`,
        "vote_count.gte": "300", page: String(page),
      });
      const j = await getJSON(`https://api.themoviedb.org/3/discover/movie?${q}`);
      return (j.results || []).map((r) => mapTmdbResult({ ...r, media_type: "movie" }));
    } catch { return []; /* esa época sin red: seguimos con las otras */ }
  }));
  const out = [];
  const longest = Math.max(...batches.map((b) => b.length));
  for (let i = 0; i < longest; i++)
    for (const b of batches) if (b[i]) out.push(b[i]);
  return out;
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

/* ---------- extras de ficha: plataformas, reparto, dirección y tráiler ---------- */

const EXTRAS_CACHE = "butaca:extras:v1";

/** Todo en UNA llamada (append_to_response): plataformas de suscripción en España
    (datos de JustWatch), reparto, dirección/creadores y tráiler de YouTube
    (preferencia: tráiler en español). Caché de 7 días por título. */
export async function fetchExtras(item, apiKey) {
  if (!apiKey || !item.tmdbId) return null;
  let cache;
  try { cache = JSON.parse(localStorage.getItem(EXTRAS_CACHE)) || {}; } catch { cache = {}; }
  const k = `${item.type}:${item.tmdbId}`;
  const hit = cache[k];
  if (hit && Date.now() - hit.ts < 7 * 864e5) return hit.data;
  const kind = item.type === "series" ? "tv" : "movie";
  const q = new URLSearchParams({
    api_key: apiKey, language: "es-ES",
    append_to_response: "videos,credits,watch/providers",
    include_video_language: "es,en",
  });
  const j = await getJSON(`https://api.themoviedb.org/3/${kind}/${item.tmdbId}?${q}`);
  const providers = [...new Set((j["watch/providers"]?.results?.ES?.flatrate || []).map((p) => p.provider_name))].slice(0, 4);
  const cast = (j.credits?.cast || []).slice(0, 4).map((p) => p.name);
  const director = kind === "tv"
    ? (j.created_by || []).map((p) => p.name).join(", ")
    : (j.credits?.crew || []).filter((p) => p.job === "Director").map((p) => p.name).join(", ");
  const vids = (j.videos?.results || []).filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  const pick = vids.find((v) => v.iso_639_1 === "es" && v.type === "Trailer")
    || vids.find((v) => v.type === "Trailer") || vids[0];
  const data = { providers, cast, director, trailer: pick ? `https://www.youtube.com/watch?v=${pick.key}` : "" };
  cache[k] = { ts: Date.now(), data };
  try { localStorage.setItem(EXTRAS_CACHE, JSON.stringify(cache)); } catch { /* sin hueco */ }
  return data;
}

/* ---------- fechas de emisión por episodio (toque largo en la rejilla) ---------- */

const SEASON_DATES_CACHE = "butaca:seasondates:v1";

/** Fechas de emisión de los episodios de una temporada. Caché de 24 h (los
    episodios futuros pueden cambiar de fecha). */
export async function fetchSeasonDates(item, season, apiKey) {
  if (!apiKey || !item.tmdbId) return [];
  let cache;
  try { cache = JSON.parse(localStorage.getItem(SEASON_DATES_CACHE)) || {}; } catch { cache = {}; }
  const k = `${item.tmdbId}:${season}`;
  const hit = cache[k];
  if (hit && Date.now() - hit.ts < 864e5) return hit.eps;
  const q = new URLSearchParams({ api_key: apiKey, language: "es-ES" });
  const j = await getJSON(`https://api.themoviedb.org/3/tv/${item.tmdbId}/season/${season}?${q}`);
  const eps = (j.episodes || []).map((e) => ({ ep: e.episode_number, air: e.air_date || "" }));
  cache[k] = { ts: Date.now(), eps };
  try { localStorage.setItem(SEASON_DATES_CACHE, JSON.stringify(cache)); } catch { /* sin hueco */ }
  return eps;
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
