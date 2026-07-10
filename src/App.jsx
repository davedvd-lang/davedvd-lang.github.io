import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ, Ban, CalendarDays, Check, ChevronRight, Clapperboard, Clock3, Dices,
  Download, Film, Flame, Globe, History, Home, KeyRound, Pause, Play, Plus, Popcorn,
  Repeat, RotateCcw, Search, Share2, Sparkles, Star, StickyNote, ThumbsDown, Timer,
  Trash2, Tv, Upload, X,
} from "lucide-react";
import { seedLibrary, catalog } from "./data.js";
import {
  checkSeasonUpdates, enrichPosters, fetchTrending, hydrateTmdbItem, loadPosterCache,
  loadTmdbKey, posterKey, saveTmdbKey, searchTmdb,
} from "./enrich.js";
import { shareCard } from "./share.js";

/* ---------- helpers de dominio ---------- */

const STATUS = {
  watching: { label: "Viendo", single: "Viendo", icon: Play },
  watchlist: { label: "Por ver", single: "Por ver", icon: Clock3 },
  paused: { label: "En pausa", single: "En pausa", icon: Pause },
  watched: { label: "Vistas", single: "Vista", icon: Check },
  dropped: { label: "Abandonadas", single: "Abandonada", icon: Ban },
  skipped: { label: "Ni con un palo", single: "Ni con un palo", icon: ThumbsDown },
};

/* estados ofrecidos por tipo: «En pausa» solo tiene sentido en series */
const STATUSES_FOR = {
  movie: ["watchlist", "watching", "watched", "dropped", "skipped"],
  series: ["watchlist", "watching", "paused", "watched", "dropped", "skipped"],
};

function seriesProgress(item) {
  const seasons = item.seasons || []; // datos antiguos o incompletos: no reventar el render
  const total = seasons.reduce((n, s) => n + s.eps, 0);
  const seen = seasons.reduce((n, s) => n + s.watched, 0);
  let next = null;
  for (let i = 0; i < seasons.length; i++) {
    if (seasons[i].watched < seasons[i].eps) {
      next = { season: i + 1, ep: seasons[i].watched + 1 };
      break;
    }
  }
  return { total, seen, pct: total ? Math.round((seen / total) * 100) : 0, next };
}

const epLabel = (n) => (n ? `T${n.season}·E${n.ep}` : "");

/** Último episodio visto ("T1·E8") o null si no ha empezado. */
function lastSeenLabel(item) {
  if (item.type !== "series") return null;
  let last = null;
  (item.seasons || []).forEach((s, i) => { if (s.watched > 0) last = `T${i + 1}·E${s.watched}`; });
  return last;
}

/** Fija el último episodio visto: temporadas previas completas, posteriores a cero.
    Repetir el toque sobre el mismo episodio lo desmarca. */
function withLastEpisode(i, seasonIdx, ep) {
  const already =
    i.seasons[seasonIdx].watched === ep &&
    i.seasons.every((s, si) =>
      si < seasonIdx ? s.watched === s.eps : si > seasonIdx ? s.watched === 0 : true
    );
  const target = already ? ep - 1 : ep;
  const seasons = i.seasons.map((s, si) =>
    si < seasonIdx ? { ...s, watched: s.eps } : si === seasonIdx ? { ...s, watched: target } : { ...s, watched: 0 }
  );
  return { ...i, seasons };
}

/** Duración estimada para ordenar: minutos de peli o total de la serie. */
const itemDuration = (it) =>
  it.type === "movie" ? (it.runtime || 999) : seriesProgress(it).total * 45;

/** Fecha de estreno: la completa si la tenemos (TMDB), si no el año. */
const releaseTs = (it) => {
  if (it.released) {
    const t = Date.parse(it.released);
    if (!Number.isNaN(t)) return t;
  }
  return it.year ? Date.UTC(it.year, 0, 1) : 0;
};

const SORTS = {
  added: { label: "Reciente", icon: History, fn: (a, b) => (b.addedAt || 0) - (a.addedAt || 0) },
  release: { label: "Estreno", icon: CalendarDays, fn: (a, b) => releaseTs(b) - releaseTs(a) },
  duration: { label: "Duración", icon: Timer, fn: (a, b) => itemDuration(a) - itemDuration(b) },
  alpha: { label: "A–Z", icon: ArrowDownAZ, fn: (a, b) => a.title.localeCompare(b.title, "es") },
};

/* ---------- diario de actividad (para racha y récords) ---------- */

const ACT_KEY = "butaca:activity:v1";

export function loadActivity() {
  try { return JSON.parse(localStorage.getItem(ACT_KEY)) || {}; } catch { return {}; }
}

const dayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Días seguidos con actividad, contando hacia atrás (hoy sin actividad aún no la rompe). */
function streakOf(activity) {
  const d = new Date();
  let n = 0;
  if (!activity[dayStr(d)]) d.setDate(d.getDate() - 1);
  while (activity[dayStr(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function hoursWatched(lib) {
  let min = 0;
  for (const it of lib) {
    if (it.type === "movie" && it.status === "watched") min += it.runtime || 110;
    if (it.type === "series") min += seriesProgress(it).seen * 45;
  }
  return Math.round(min / 60);
}

/* ---------- átomos de UI ---------- */

const PosterCtx = createContext({});

function Poster({ item, className = "", emojiClass = "text-4xl" }) {
  const cache = useContext(PosterCtx);
  const [broken, setBroken] = useState(false);
  const src = item.img || cache[posterKey(item)] || null;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(160deg, ${item.poster.from} -20%, ${item.poster.to} 85%)` }}
    >
      <span className={`${emojiClass} drop-shadow-lg`} aria-hidden>{item.poster.emoji}</span>
      {src && !broken && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(255,255,255,.14),transparent_55%)]" />
    </div>
  );
}

function ProgressBar({ pct, className = "" }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brass to-brass2 transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Stars({ value = 0, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "active:scale-90 transition-transform" : "pointer-events-none"}
          aria-label={`${n} estrellas`}
        >
          <Star
            size={onChange ? 26 : 13}
            className={n <= value ? "fill-brass text-brass" : "text-fog/40"}
          />
        </button>
      ))}
    </div>
  );
}

/* ---------- pantalla: Hoy (dashboard) ---------- */

function WatchingCard({ item, onAdvance, onOpen }) {
  const isSeries = item.type === "series";
  const prog = isSeries ? seriesProgress(item) : null;
  const [pulse, setPulse] = useState(0);

  return (
    <div className="w-60 shrink-0 snap-start overflow-hidden rounded-3xl bg-panel ring-1 ring-line">
      <button onClick={onOpen} className="relative block w-full text-left">
        <Poster item={item} className="h-32 w-full" emojiClass="text-5xl" />
        {item.rewatching && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-brass2 backdrop-blur">
            <Repeat size={10} /> Revisionado
          </span>
        )}
        <div className="px-4 pt-3">
          <p className="truncate text-base font-bold text-snow">{item.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fog">
            {isSeries ? <Tv size={12} /> : <Film size={12} />}
            {isSeries ? `${prog.seen}/${prog.total} caps · ${prog.pct}%` : `${item.runtime} min · película`}
          </p>
          {isSeries && <ProgressBar pct={prog.pct} className="mt-2.5" />}
        </div>
      </button>
      <div className="p-3">
        <button
          key={pulse}
          onClick={() => { setPulse((p) => p + 1); onAdvance(item); }}
          className="animate-pop flex w-full items-center justify-center gap-2 rounded-2xl bg-brass py-2.5 text-sm font-bold text-ink shadow-lg shadow-brass/25 transition-transform active:scale-95"
        >
          <Check size={16} strokeWidth={3} />
          {isSeries ? `${epLabel(prog.next)} vista` : "Terminada"}
        </button>
      </div>
    </div>
  );
}

function TonightRow({ item, onStart, onOpen }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-panel p-2.5 ring-1 ring-line">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Poster item={item} className="h-14 w-11 shrink-0 rounded-xl" emojiClass="text-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-snow">{item.title}</p>
          <p className="truncate text-xs text-fog">
            {item.type === "movie" ? `${item.runtime} min` : `${item.seasons.length} temporadas`} · {item.genre}
          </p>
        </div>
      </button>
      <button
        onClick={() => onStart(item)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass ring-1 ring-brass/30 transition-transform active:scale-90"
        aria-label={`Empezar ${item.title}`}
      >
        <Play size={16} className="ml-0.5 fill-brass" />
      </button>
    </div>
  );
}

function HomeView({ lib, streak, pausedNews, onAdvance, onStart, onOpen, onAdd, onPaused, onSurprise, onDiscover }) {
  const watching = lib.filter((i) => i.status === "watching");
  const watchlist = lib.filter((i) => i.status === "watchlist");
  const watched = lib.filter((i) => i.status === "watched");
  const paused = lib.filter((i) => i.status === "paused");
  const hour = new Date().getHours();
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-7 pb-6">
      <header className="px-5 pt-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-brass">
          <Popcorn size={15} /> BUTACA
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-snow">
          {greeting} 🍿 ¿Qué toca hoy?
        </h1>
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
          {streak >= 2 && (
            <span className="chip"><Flame size={13} className="text-brass" /> racha de {streak} días</span>
          )}
          <span className="chip"><Play size={13} className="text-brass" /> {watching.length} en curso</span>
          <span className="chip"><Clock3 size={13} className="text-brass" /> {watchlist.length} pendientes</span>
          <span className="chip"><Sparkles size={13} className="text-brass" /> {hoursWatched(lib)} h vistas</span>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between px-5">
          <h2 className="text-lg font-bold text-snow">Sigues viendo</h2>
          <span className="text-xs font-medium text-fog">un toque = capítulo visto</span>
        </div>
        {watching.length === 0 ? (
          <div className="mx-5 rounded-3xl border border-dashed border-line p-6 text-center text-sm text-fog">
            Nada en curso. Elige algo de tu lista 👇
          </div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {watching.map((it) => (
              <WatchingCard key={it.id} item={it} onAdvance={onAdvance} onOpen={() => onOpen(it.id)} />
            ))}
          </div>
        )}
        {paused.length > 0 && (
          <button
            onClick={onPaused}
            className="mx-5 mt-3 flex items-center gap-2 rounded-full bg-panel px-3.5 py-2 text-xs font-semibold text-fog ring-1 ring-line transition-colors active:scale-95"
          >
            <Pause size={12} className="text-brass" />
            {paused.length === 1 ? "1 serie en pausa" : `${paused.length} series en pausa`}
            {pausedNews > 0
              ? <span className="font-bold text-mint">· ¡{pausedNews} con episodios nuevos!</span>
              : " · esperando temporada"}
            <ChevronRight size={13} />
          </button>
        )}
      </section>

      <section className="px-5">
        <button
          onClick={onDiscover}
          className="flex w-full items-center justify-between rounded-3xl bg-gradient-to-r from-brass/20 to-brass/5 p-4 ring-1 ring-brass/30 transition-transform active:scale-[.98]"
        >
          <span className="text-left">
            <span className="block text-base font-extrabold tracking-tight text-snow">🔥 Descubrir</span>
            <span className="mt-0.5 block text-xs text-fog">desliza y decide: 🥢 no · ➕ por ver · ✓ vista</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-brass" />
        </button>
      </section>

      <section className="px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-snow">Para esta noche</h2>
          <button
            onClick={onSurprise}
            className="flex items-center gap-1.5 rounded-full bg-brass/15 px-3 py-1.5 text-xs font-bold text-brass ring-1 ring-brass/30 transition-transform active:scale-95"
          >
            <Dices size={13} /> Sorpréndeme
          </button>
        </div>
        <div className="space-y-2.5">
          {watchlist.slice(0, 4).map((it) => (
            <TonightRow key={it.id} item={it} onStart={onStart} onOpen={() => onOpen(it.id)} />
          ))}
          {watchlist.length === 0 && (
            <button onClick={onAdd} className="w-full rounded-3xl border border-dashed border-line p-6 text-center text-sm text-fog">
              Tu watchlist está vacía. Toca para añadir algo ✨
            </button>
          )}
        </div>
      </section>

      {watched.length > 0 && (
        <section className="px-5">
          <h2 className="mb-3 text-lg font-bold text-snow">Últimas vistas</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {watched.slice(0, 8).map((it) => (
              <button key={it.id} onClick={() => onOpen(it.id)} className="w-20 shrink-0 text-left">
                <Poster item={it} className="h-28 w-20 rounded-2xl ring-1 ring-line" emojiClass="text-2xl" />
                <p className="mt-1.5 truncate text-[11px] font-semibold text-fog">{it.title}</p>
                {it.rating ? <Stars value={it.rating} /> : null}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- pantalla: biblioteca (Pelis / Series) ---------- */

function LibraryView({ lib, type, tab, updates, onTab, onOpen, onAdvance, onResume }) {
  const [sort, setSort] = useState("added");
  const [genreF, setGenreF] = useState("all");
  const items = lib.filter((i) => i.type === type);
  const byStatus = (s) => items.filter((i) => i.status === s);
  const genres = [...new Set(
    items.flatMap((i) => (i.genre || "").split("·").map((g) => g.trim()).filter(Boolean))
  )].sort((a, b) => a.localeCompare(b, "es"));
  const shown = [...byStatus(tab)]
    .filter((i) => genreF === "all" || (i.genre || "").includes(genreF))
    .sort(SORTS[sort].fn);
  const isSeries = type === "series";

  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="flex items-center gap-2.5 text-[26px] font-extrabold tracking-tight text-snow">
        {isSeries ? <Tv className="text-brass" size={24} /> : <Clapperboard className="text-brass" size={24} />}
        {isSeries ? "Series" : "Películas"}
      </h1>

      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        {STATUSES_FOR[type].map((s) => (
          <button
            key={s}
            onClick={() => onTab(s)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition-colors active:scale-95 ${
              tab === s ? "bg-brass text-ink shadow-lg shadow-brass/20" : "bg-panel text-fog ring-1 ring-line"
            }`}
          >
            {STATUS[s].label}
            <span className={`ml-1.5 text-xs ${tab === s ? "text-ink/60" : "text-fog/60"}`}>
              {byStatus(s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="-mx-5 mt-3 flex items-center gap-1.5 overflow-x-auto px-5 no-scrollbar">
        <span className="mr-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-fog/60">Ordenar</span>
        {Object.entries(SORTS).map(([k, s]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
              sort === k ? "bg-brass/15 text-brass ring-1 ring-brass/30" : "text-fog"
            }`}
          >
            <s.icon size={11} /> {s.label}
          </button>
        ))}
      </div>

      {genres.length >= 2 && (
        <div className="-mx-5 mt-2 flex items-center gap-1.5 overflow-x-auto px-5 no-scrollbar">
          <span className="mr-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wide text-fog/60">Género</span>
          {["all", ...genres].map((g) => (
            <button
              key={g}
              onClick={() => setGenreF(g)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                genreF === g ? "bg-brass/15 text-brass ring-1 ring-brass/30" : "text-fog"
              }`}
            >
              {g === "all" ? "Todos" : g}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mt-10 text-center text-sm text-fog">
          Nada por aquí todavía. Añade títulos con el botón <span className="font-bold text-brass">+</span>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {shown.map((it) => {
            const prog = isSeries ? seriesProgress(it) : null;
            const left = lastSeenLabel(it);
            return (
              <div key={it.id} className="group relative">
                <button onClick={() => onOpen(it.id)} className="block w-full text-left transition-transform active:scale-95">
                  <div className="relative overflow-hidden rounded-2xl ring-1 ring-line">
                    <Poster item={it} className="aspect-[2/3] w-full" emojiClass="text-3xl" />
                    {(it.rewatches || it.rewatching) && (
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-brass2 backdrop-blur">
                        <Repeat size={9} /> ×{(it.rewatches || 0) + 1}
                      </span>
                    )}
                    {isSeries && tab === "watching" && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
                        <p className="text-[10px] font-bold text-brass2">{epLabel(prog.next)} siguiente</p>
                        <ProgressBar pct={prog.pct} className="mt-1 h-1" />
                      </div>
                    )}
                    {tab === "paused" && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
                        <p className={`text-[10px] font-bold ${updates[posterKey(it)] ? "text-mint" : "text-snow/90"}`}>
                          {updates[posterKey(it)]
                            ? "🎉 ¡Episodios nuevos!"
                            : prog.next ? `Al día · sigue ${epLabel(prog.next)}` : "Esperando temporada"}
                        </p>
                      </div>
                    )}
                    {tab === "dropped" && isSeries && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-5">
                        <p className="text-[10px] font-bold text-snow/90">
                          {left ? `La dejaste en ${left}` : "Sin empezar"}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-xs font-bold text-snow">{it.title}</p>
                  <p className="truncate text-[10px] text-fog">
                    {it.year}{it.type === "movie" && sort === "duration" ? ` · ${it.runtime} min` : ""}
                  </p>
                </button>
                {tab === "watched" && it.rating ? (
                  <div className="mt-0.5"><Stars value={it.rating} /></div>
                ) : null}
                {tab === "watching" && (
                  <button
                    onClick={() => onAdvance(it)}
                    aria-label={isSeries ? `Marcar ${epLabel(prog.next)} de ${it.title}` : `Terminar ${it.title}`}
                    className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brass text-ink shadow-lg shadow-black/40 ring-2 ring-ink transition-transform active:scale-90"
                  >
                    <Check size={15} strokeWidth={3.5} />
                  </button>
                )}
                {tab === "paused" && (
                  <button
                    onClick={() => onResume(it)}
                    aria-label={`Reanudar ${it.title}`}
                    className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brass text-ink shadow-lg shadow-black/40 ring-2 ring-ink transition-transform active:scale-90"
                  >
                    <Play size={14} className="ml-0.5 fill-ink" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- ficha (bottom sheet) ---------- */

function DetailSheet({ item, preview = false, update, onApplyUpdate, onNote, onShare, onClose, onSetStatus, onSetEpisode, onAdvance, onRate, onRewatch, onRemove }) {
  const isSeries = item.type === "series";
  const prog = isSeries ? seriesProgress(item) : null;
  const left = lastSeenLabel(item);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadein" onClick={onClose} aria-label="Cerrar" />
      <div className="animate-sheet relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-panel ring-1 ring-line">
        <div className="sticky top-0 z-10">
          <Poster item={item} className="h-36 w-full" emojiClass="text-6xl" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-snow backdrop-blur transition-transform active:scale-90"
            aria-label="Cerrar ficha"
          >
            <X size={18} />
          </button>
          <div className="absolute inset-x-5 bottom-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-snow drop-shadow">{item.title}</h2>
          </div>
        </div>

        <div className="space-y-5 px-5 pb-8 pt-3">
          <p className="flex items-center gap-1.5 text-sm text-fog">
            {isSeries ? <Tv size={14} /> : <Film size={14} />}
            {item.year} · {item.genre}{item.runtime ? ` · ${item.runtime} min` : ""}
          </p>

          {item.synopsis && (
            <p className="text-sm leading-relaxed text-fog">{item.synopsis}</p>
          )}

          {preview && (
            <p className="flex items-center gap-2 rounded-2xl bg-brass/10 p-3.5 text-xs font-semibold leading-relaxed text-brass2 ring-1 ring-brass/25">
              <Plus size={14} className="shrink-0" />
              Aún no está en tu videoteca: elige un estado{isSeries ? " o toca el último capítulo que viste" : ""} y se guarda sola.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {STATUSES_FOR[item.type].map((s) => {
              const Icon = STATUS[s].icon;
              const active = item.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onSetStatus(item, s)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all duration-150 active:scale-95 ${
                    active ? "bg-brass text-ink shadow-lg shadow-brass/20" : "bg-panel2 text-fog ring-1 ring-line"
                  }`}
                >
                  <Icon size={13} /> {STATUS[s].single}
                </button>
              );
            })}
          </div>

          {update && !preview && (
            <button
              onClick={() => onApplyUpdate(item)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-mint/10 p-3.5 text-sm font-bold text-mint ring-1 ring-mint/30 transition-transform active:scale-[.97]"
            >
              🎉 Hay episodios nuevos — actualizar temporadas
            </button>
          )}

          {item.status === "paused" && (
            <p className="flex items-center gap-2 rounded-2xl bg-panel2 p-3.5 text-xs leading-relaxed text-fog ring-1 ring-line">
              <Pause size={14} className="shrink-0 text-brass" />
              {prog?.next
                ? `En pausa: te quedaste en ${left || "el principio"}. Cuando quieras, reanuda con ▶.`
                : "Al día. Esperando nueva temporada — reanúdala cuando se estrene."}
            </p>
          )}

          {item.status === "dropped" && (
            <p className="flex items-center gap-2 rounded-2xl bg-panel2 p-3.5 text-xs leading-relaxed text-fog ring-1 ring-line">
              <Ban size={14} className="shrink-0 text-fog" />
              {isSeries
                ? `Abandonada${left ? ` en ${left}` : " sin empezar"}. Queda registrada para no volver a picar.`
                : "Abandonada. Queda registrada para no volver a picar."}
            </p>
          )}

          {item.status === "skipped" && (
            <p className="flex items-center gap-2 rounded-2xl bg-panel2 p-3.5 text-xs leading-relaxed text-fog ring-1 ring-line">
              <ThumbsDown size={14} className="shrink-0 text-fog" />
              Ni con un palo 🥢 — no volverá a aparecer en Descubrir ni como sugerencia. Cambia el estado si un día te reconcilias.
            </p>
          )}

          {item.status === "watched" && (
            <div className="flex items-center justify-between rounded-2xl bg-panel2 p-4 ring-1 ring-line">
              <p className="text-sm font-semibold text-snow">Tu nota</p>
              <Stars value={item.rating || 0} onChange={(n) => onRate(item, n)} />
            </div>
          )}

          {item.status === "watched" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-panel2 p-4 ring-1 ring-line">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-snow">
                  <Repeat size={14} className="text-brass" /> Revisionados
                </p>
                <p className="mt-0.5 text-xs text-fog">
                  {item.rewatches ? `Vista ${item.rewatches + 1} veces` : "Vista 1 vez"}
                </p>
              </div>
              <button
                onClick={() => onRewatch(item)}
                className="shrink-0 rounded-full bg-brass/15 px-3.5 py-2 text-xs font-bold text-brass ring-1 ring-brass/30 transition-transform active:scale-95"
              >
                {isSeries ? "▶ Volver a empezar" : "+1 vista otra vez"}
              </button>
            </div>
          )}

          {item.rewatching && (
            <p className="flex items-center gap-2 rounded-2xl bg-brass/10 p-3.5 text-xs font-semibold text-brass2 ring-1 ring-brass/25">
              <Repeat size={14} className="shrink-0" />
              Revisionado nº{(item.rewatches || 0) + 1} en curso — tu historial de «vista» se conserva.
            </p>
          )}

          {item.status === "watched" && !preview && (
            <button
              onClick={() => onShare(item)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-panel2 py-3 text-sm font-bold text-snow ring-1 ring-line transition-transform active:scale-[.97]"
            >
              <Share2 size={16} className="text-brass" /> Compartir tarjeta
            </button>
          )}

          {!preview && (
            <div className="rounded-2xl bg-panel2 p-3.5 ring-1 ring-line">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-snow">
                <StickyNote size={14} className="text-brass" /> Nota privada
              </p>
              <textarea
                value={item.note || ""}
                onChange={(e) => onNote(item, e.target.value)}
                placeholder="Solo para ti: «verla con María», «el final se explica en…»"
                rows={2}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-snow outline-none placeholder:text-fog/50"
              />
            </div>
          )}

          {isSeries && (
            <>
              {prog.next && (item.status === "watching" || item.status === "paused") && (
                <button
                  onClick={() => onAdvance(item)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brass py-3.5 text-base font-bold text-ink shadow-lg shadow-brass/25 transition-transform active:scale-[.97]"
                >
                  <Check size={18} strokeWidth={3} /> Marcar {epLabel(prog.next)} como vista
                </button>
              )}

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-base font-bold text-snow">Temporadas</h3>
                  <span className="text-xs text-fog">{prog.seen}/{prog.total} capítulos · toca el último visto</span>
                </div>
                <div className="space-y-3">
                  {item.seasons.map((s, si) => (
                    <div key={si} className="rounded-2xl bg-panel2 p-3.5 ring-1 ring-line">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-sm font-bold text-snow">Temporada {si + 1}</p>
                        <span className={`text-xs font-semibold ${s.watched === s.eps ? "text-mint" : "text-fog"}`}>
                          {s.watched === s.eps ? "✓ Completa" : `${s.watched}/${s.eps}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: s.eps }, (_, ei) => {
                          const n = ei + 1;
                          const seen = n <= s.watched;
                          return (
                            <button
                              key={n}
                              onClick={() => onSetEpisode(item, si, n)}
                              aria-label={`Episodio ${n} temporada ${si + 1}`}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-90 ${
                                seen
                                  ? "bg-brass text-ink shadow-sm shadow-brass/30"
                                  : "bg-white/5 text-fog ring-1 ring-line hover:ring-brass/40"
                              }`}
                            >
                              {seen ? <Check size={13} strokeWidth={3.5} /> : n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!preview && (
            <button
              onClick={() => onRemove(item)}
              className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-fog/70 transition-colors hover:text-red-400"
            >
              <Trash2 size={13} /> Eliminar de mi videoteca
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- añadir (buscador) ---------- */

function AddSheet({ lib, tmdbKey, onClose, onAdd, onPreview }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [online, setOnline] = useState(null); // null = sin búsqueda online activa
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  // Con API key de TMDB el buscador es online y global (debounce de 400 ms)
  useEffect(() => {
    if (!tmdbKey || q.trim().length < 2) { setOnline(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setOnline(await searchTmdb(q.trim(), tmdbKey)); }
      catch { setOnline([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q, tmdbKey]);

  const inLib = (c) => lib.find((i) => i.title === c.title && i.type === c.type);
  const pool = online ?? catalog.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  const results = pool.filter((c) => filter === "all" || c.type === filter);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadein" onClick={onClose} aria-label="Cerrar" />
      <div className="animate-sheet relative flex h-[88dvh] w-full max-w-md flex-col rounded-t-[28px] bg-panel ring-1 ring-line">
        <div className="space-y-3 p-5 pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-snow">Añadir título</h2>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-snow transition-transform active:scale-90" aria-label="Cerrar buscador">
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-panel2 px-4 py-3 ring-1 ring-line focus-within:ring-brass/50">
            <Search size={17} className="shrink-0 text-fog" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca una peli o serie…"
              className="w-full bg-transparent text-sm text-snow outline-none placeholder:text-fog/60"
            />
          </div>
          <div className="flex gap-2">
            {[["all", "Todo"], ["movie", "Pelis"], ["series", "Series"]].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filter === v ? "bg-brass text-ink" : "bg-white/5 text-fog ring-1 ring-line"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-8">
          {searching && (
            <p className="flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-fog">
              <Globe size={13} className="animate-spin text-brass" /> Buscando en TMDB…
            </p>
          )}
          {results.map((c) => {
            const owned = inLib(c);
            const added = !!owned;
            return (
              <div key={c.tmdbId || c.title} className="rounded-2xl bg-panel2 p-2.5 ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onPreview(c)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform active:scale-[.98]"
                    aria-label={`Ver ficha de ${c.title}`}
                  >
                    <Poster item={c} className="h-16 w-12 shrink-0 rounded-xl" emojiClass="text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-snow">{c.title}</p>
                      <p className="truncate text-xs text-fog">
                        {c.type === "movie" ? "Película" : "Serie"}{c.year ? ` · ${c.year}` : ""}
                      </p>
                      {c.synopsis && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fog/80">{c.synopsis}</p>
                      )}
                    </div>
                  </button>
                  {added ? (
                    owned.status === "skipped" ? (
                      <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-fog ring-1 ring-line">
                        🥢 Ni con un palo
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-mint/10 px-2.5 py-1 text-[10px] font-bold text-mint ring-1 ring-mint/30">
                        ✓ En tu lista
                      </span>
                    )
                  ) : (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => onAdd(c, "watchlist")} className="add-mini justify-center" aria-label={`Añadir ${c.title} a Por ver`}>
                        <Clock3 size={14} /><span>Por ver</span>
                      </button>
                      <button onClick={() => onAdd(c, "watching")} className="add-mini justify-center" aria-label={`Añadir ${c.title} a Viendo`}>
                        <Play size={14} /><span>Viendo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {results.length === 0 && !searching && (
            <p className="pt-10 text-center text-sm text-fog">Sin resultados para «{q}» 🎬</p>
          )}
          {!tmdbKey && (
            <p className="flex items-center justify-center gap-1.5 pt-3 text-center text-[11px] text-fog/70">
              <KeyRound size={12} /> Conecta tu API key de TMDB en «Stats» para buscar cualquier título online
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


/* ---------- Descubrir: desliza y decide (el «tinder» de pelis) ---------- */

const SWIPE = {
  left: { status: "skipped", label: "NI CON UN PALO", emoji: "🥢", color: "#97a3bd" },
  up: { status: "watchlist", label: "POR VER", emoji: "➕", color: "#f4b43e" },
  right: { status: "watched", label: "VISTA", emoji: "✓", color: "#4ade80" },
};

function DiscoverDeck({ cards, canLoadMore, onDecide, onLoadMore, onClose }) {
  const [drag, setDrag] = useState(null);   // {dx, dy} mientras arrastras
  const [fly, setFly] = useState(null);     // dirección de salida animada
  const startRef = useRef(null);

  const current = cards[0];
  const dir = drag
    ? drag.dy < -70 && Math.abs(drag.dy) > Math.abs(drag.dx) ? "up"
      : drag.dx > 70 ? "right" : drag.dx < -70 ? "left" : null
    : null;

  const release = () => {
    if (fly) return;
    if (dir) {
      setFly(dir);
      setTimeout(() => { onDecide(current, dir); setFly(null); setDrag(null); }, 260);
    } else {
      setDrag(null);
    }
  };
  const decideByButton = (d) => {
    if (fly || !current) return;
    setFly(d);
    setTimeout(() => { onDecide(current, d); setFly(null); setDrag(null); }, 260);
  };

  const flyTransform = {
    left: "translate(-120vw, 0) rotate(-24deg)",
    right: "translate(120vw, 0) rotate(24deg)",
    up: "translate(0, -120vh)",
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-snow">Descubrir</h2>
          <p className="text-xs text-fog">desliza: 🥢 ni con un palo · ⬆ por ver · ✓ vista</p>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-snow transition-transform active:scale-90" aria-label="Cerrar Descubrir">
          <X size={18} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-6 py-3">
        {cards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl">🍿</p>
            <p className="max-w-60 text-sm text-fog">No quedan candidatos por ahora.</p>
            {canLoadMore && (
              <button onClick={onLoadMore} className="rounded-full bg-brass px-4 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95">
                Cargar más
              </button>
            )}
          </div>
        ) : (
          cards.slice(0, 3).map((c, i) => {
            const top = i === 0;
            const style = top
              ? fly
                ? { transform: flyTransform[fly], opacity: 0, transition: "transform .26s ease-in, opacity .26s ease-in" }
                : drag
                  ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * 0.05}deg)` }
                  : { transition: "transform .2s ease-out" }
              : { transform: `scale(${1 - i * 0.05}) translateY(${i * 14}px)`, transition: "transform .25s ease-out" };
            return (
              <div
                key={`${c.type}:${c.tmdbId || c.title}`}
                className="absolute inset-x-6 top-3 bottom-3 touch-none select-none overflow-hidden rounded-[28px] bg-panel ring-1 ring-line"
                style={{ ...style, zIndex: 10 - i }}
                onPointerDown={top ? (e) => { startRef.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); } : undefined}
                onPointerMove={top ? (e) => { if (startRef.current) setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y }); } : undefined}
                onPointerUp={top ? () => { startRef.current = null; release(); } : undefined}
                onPointerCancel={top ? () => { startRef.current = null; setDrag(null); } : undefined}
              >
                <Poster item={c} className="h-3/5 w-full" emojiClass="text-7xl" />
                <div className="flex h-2/5 flex-col gap-1.5 p-4">
                  <p className="text-xl font-extrabold tracking-tight text-snow">{c.title}</p>
                  <p className="text-xs text-fog">
                    {c.type === "movie" ? "Película" : "Serie"}{c.year ? ` · ${c.year}` : ""}{c.runtime ? ` · ${c.runtime} min` : ""}
                  </p>
                  {c.synopsis && <p className="line-clamp-4 text-sm leading-relaxed text-fog">{c.synopsis}</p>}
                </div>
                {top && dir && (
                  <span
                    className="absolute left-1/2 top-16 -translate-x-1/2 rounded-2xl px-4 py-2 text-2xl font-extrabold tracking-widest"
                    style={{ color: SWIPE[dir].color, border: `4px solid ${SWIPE[dir].color}`, background: "rgba(11,14,22,.72)", transform: `translateX(-50%) rotate(${dir === "left" ? -8 : dir === "right" ? 8 : 0}deg)` }}
                  >
                    {SWIPE[dir].emoji} {SWIPE[dir].label}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {current && (
        <div className="flex items-center justify-center gap-5 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
          <button onClick={() => decideByButton("left")} aria-label="Ni con un palo"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-panel text-2xl ring-1 ring-line transition-transform active:scale-90">
            🥢
          </button>
          <button onClick={() => decideByButton("up")} aria-label="Añadir a Por ver"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brass text-ink shadow-lg shadow-brass/30 transition-transform active:scale-90">
            <Plus size={30} strokeWidth={2.75} />
          </button>
          <button onClick={() => decideByButton("right")} aria-label="Marcar como vista"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-mint/15 text-mint ring-1 ring-mint/40 transition-transform active:scale-90">
            <Check size={26} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- barra de navegación ---------- */

function TabBar({ tab, onTab, onAdd }) {
  const Item = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => onTab(id)}
      className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors ${
        tab === id ? "text-brass" : "text-fog"
      }`}
    >
      <Icon size={21} strokeWidth={tab === id ? 2.5 : 2} />
      {label}
    </button>
  );
  return (
    <nav className="pointer-events-auto sticky bottom-0 z-30 border-t border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1">
        <Item id="home" icon={Home} label="Hoy" />
        <Item id="movie" icon={Film} label="Pelis" />
        <div className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Añadir título"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brass text-ink shadow-xl shadow-brass/30 ring-4 ring-ink transition-transform active:scale-90"
          >
            <Plus size={26} strokeWidth={2.75} />
          </button>
        </div>
        <Item id="series" icon={Tv} label="Series" />
        <Item id="stats" icon={Sparkles} label="Stats" />
      </div>
    </nav>
  );
}

/* ---------- stats (mini) ---------- */

function StatsView({ lib, activity, tmdbKey, onSaveKey, onReset, onExport, onImport }) {
  const [draft, setDraft] = useState(tmdbKey);
  const [editKey, setEditKey] = useState(!tmdbKey); // con clave puesta, el bloque se pliega
  const fileRef = useRef(null);
  const streak = streakOf(activity);
  const year = new Date().getFullYear();
  const thisYear = lib.filter((i) => i.watchedAt && new Date(i.watchedAt).getFullYear() === year).length;
  const rated = lib.filter((i) => i.rating);
  const avg = rated.length ? (rated.reduce((n, i) => n + i.rating, 0) / rated.length).toFixed(1) : null;
  const recordDay = Math.max(0, ...Object.values(activity));
  const podium = [...lib]
    .filter((i) => i.status === "watched" && i.rating)
    .sort((a, b) => b.rating - a.rating || (b.rewatches || 0) - (a.rewatches || 0) || (b.watchedAt || 0) - (a.watchedAt || 0))
    .slice(0, 3);
  const movies = lib.filter((i) => i.type === "movie");
  const series = lib.filter((i) => i.type === "series");
  const eps = series.reduce((n, s) => n + seriesProgress(s).seen, 0);
  const cells = [
    { label: "Horas vistas", value: `${hoursWatched(lib)} h`, icon: Clock3 },
    { label: "Películas vistas", value: movies.filter((m) => m.status === "watched").length, icon: Film },
    { label: "Capítulos vistos", value: eps, icon: Tv },
    { label: "Series terminadas", value: series.filter((s) => s.status === "watched").length, icon: Check },
    { label: "Revisionados", value: lib.reduce((n, i) => n + (i.rewatches || 0), 0), icon: Repeat },
    { label: "Abandonadas", value: lib.filter((i) => i.status === "dropped").length, icon: Ban },
    { label: `Vistas en ${year}`, value: thisYear, icon: CalendarDays },
    { label: "Racha actual", value: streak ? `${streak} ${streak === 1 ? "día" : "días"}` : "—", icon: Flame },
    { label: "Nota media", value: avg ? `★ ${avg}` : "—", icon: Star },
    { label: "Récord en un día", value: recordDay ? `${recordDay} caps` : "—", icon: Sparkles },
  ];
  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="flex items-center gap-2.5 text-[26px] font-extrabold tracking-tight text-snow">
        <Sparkles className="text-brass" size={24} /> Tu tiempo en pantalla
      </h1>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-3xl bg-panel p-4 ring-1 ring-line">
            <c.icon size={18} className="text-brass" />
            <p className="mt-3 text-2xl font-extrabold tracking-tight text-snow">{c.value}</p>
            <p className="mt-0.5 text-xs font-medium text-fog">{c.label}</p>
          </div>
        ))}
      </div>
      {podium.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-snow">Tu podio</h2>
          <div className="grid grid-cols-3 gap-3">
            {podium.map((it, i) => (
              <div key={it.id} className="text-center">
                <div className="relative">
                  <Poster item={it} className="aspect-[2/3] w-full rounded-2xl ring-1 ring-line" emojiClass="text-3xl" />
                  <span className="absolute -left-1 -top-2 text-2xl drop-shadow">{["🥇", "🥈", "🥉"][i]}</span>
                </div>
                <p className="mt-1.5 truncate text-xs font-bold text-snow">{it.title}</p>
                <p className="text-[10px] font-semibold text-brass">{"★".repeat(it.rating)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tmdbKey && !editKey ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-snow">
            <Globe size={15} className="shrink-0 text-brass" /> Búsqueda online
            <span className="truncate text-xs font-semibold text-mint">✓ TMDB conectado</span>
          </p>
          <button
            onClick={() => { setDraft(tmdbKey); setEditKey(true); }}
            className="shrink-0 rounded-full bg-panel2 px-3.5 py-2 text-xs font-bold text-fog ring-1 ring-line transition-transform active:scale-95"
          >
            Editar
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-3xl bg-panel p-4 ring-1 ring-line">
          <p className="flex items-center gap-2 text-sm font-bold text-snow">
            <Globe size={15} className="text-brass" /> Búsqueda online (TMDB)
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-fog">
            Con una API key gratuita de <span className="font-semibold text-snow">themoviedb.org</span> el
            buscador encuentra cualquier título, con carátula y sinopsis en español. La clave se guarda
            solo en tu dispositivo.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Pega aquí tu API key…"
              className="min-w-0 flex-1 rounded-xl bg-panel2 px-3 py-2.5 text-xs text-snow ring-1 ring-line outline-none placeholder:text-fog/50 focus:ring-brass/50"
            />
            <button
              onClick={() => { const k = draft.trim(); onSaveKey(k); setEditKey(!k); }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brass px-3.5 text-xs font-bold text-ink transition-transform active:scale-95"
            >
              <KeyRound size={13} /> Guardar
            </button>
          </div>
          {tmdbKey && (
            <button
              onClick={() => { setDraft(""); onSaveKey(""); }}
              className="mt-2.5 text-xs font-semibold text-fog/70 transition-colors hover:text-red-400"
            >
              Desconectar TMDB
            </button>
          )}
        </div>
      )}

      <div className="mt-3 rounded-3xl bg-panel p-4 ring-1 ring-line">
        <p className="flex items-center gap-2 text-sm font-bold text-snow">
          <Download size={15} className="text-brass" /> Copia de seguridad
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fog">
          Exporta tu videoteca a un archivo JSON y guárdalo donde quieras. Importar
          reemplaza la videoteca actual por la del archivo.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onExport}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brass py-2.5 text-xs font-bold text-ink transition-transform active:scale-95"
          >
            <Download size={13} /> Exportar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-panel2 py-2.5 text-xs font-bold text-snow ring-1 ring-line transition-transform active:scale-95"
          >
            <Upload size={13} /> Importar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Importar copia de seguridad"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <button
        onClick={onReset}
        className="mx-auto mt-6 flex items-center gap-1.5 text-xs font-semibold text-fog/70 transition-colors hover:text-red-400"
      >
        <RotateCcw size={13} /> Restablecer datos de ejemplo
      </button>

      <p className="mt-4 text-center text-xs text-fog/70">
        Tu videoteca se guarda en este dispositivo · nunca sale de él
      </p>
    </div>
  );
}

/* ---------- App ---------- */

let nextId = 1000;

const LIB_KEY = "butaca:lib:v1";

function loadLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIB_KEY));
    if (Array.isArray(saved) && saved.length) {
      nextId = Math.max(nextId, ...saved.map((i) => i.id)) + 1;
      return saved;
    }
  } catch { /* datos corruptos: arrancamos de cero */ }
  return seedLibrary;
}

export default function App() {
  const [lib, setLib] = useState(loadLibrary);
  const [tab, setTab] = useState("home");
  const [movieTab, setMovieTab] = useState("watching");
  const [seriesTab, setSeriesTab] = useState("watching");
  const [detailId, setDetailId] = useState(null);
  const [preview, setPreview] = useState(null); // ficha de un título aún fuera de la videoteca
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [posters, setPosters] = useState(loadPosterCache);
  const [tmdbKey, setTmdbKey] = useState(loadTmdbKey);
  const [activity, setActivity] = useState(loadActivity);
  const [updates, setUpdates] = useState({}); // series con episodios nuevos en TMDB
  const [deck, setDeck] = useState(null); // Descubrir: { cards, page } o null
  const deckLoading = useRef(false);
  const toastTimer = useRef(null);

  // diario de actividad: +n capítulos/pelis marcados hoy
  const logActivity = (n = 1) => {
    if (n <= 0) return;
    setActivity((a) => {
      const next = { ...a, [dayStr()]: (a[dayStr()] || 0) + n };
      try { localStorage.setItem(ACT_KEY, JSON.stringify(next)); } catch { /* sin hueco */ }
      return next;
    });
  };

  // una vez por apertura: ¿alguna serie en pausa/en curso tiene episodios nuevos?
  useEffect(() => {
    if (!tmdbKey) return;
    checkSeasonUpdates(lib, tmdbKey, (k, seasons) =>
      setUpdates((u) => ({ ...u, [k]: seasons }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbKey]);

  // La biblioteca vive solo en tu dispositivo
  useEffect(() => {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch { /* sin hueco */ }
  }, [lib]);

  // Carátulas reales para lo que aún no tenga (TVmaze / iTunes / TMDB)
  const missing = lib.filter((i) => !i.img && !(posterKey(i) in posters)).map(posterKey).join("|");
  useEffect(() => {
    if (missing) enrichPosters(lib, tmdbKey, setPosters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, tmdbKey]);

  const detail = useMemo(() => lib.find((i) => i.id === detailId) || null, [lib, detailId]);

  const say = (msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const patch = (id, fn) => setLib((L) => L.map((i) => (i.id === id ? fn(i) : i)));

  /* al completar (o completar de nuevo): cuadrar estado, revisionados y fecha de visionado */
  const finish = (i) => ({
    ...i,
    status: "watched",
    watchedAt: Date.now(),
    rewatches: i.rewatching ? (i.rewatches || 0) + 1 : i.rewatches,
    rewatching: undefined,
  });

  /* +1 capítulo (o terminar película) — la acción de un solo toque */
  const advance = (item) => {
    logActivity(1);
    if (item.type === "movie") {
      patch(item.id, finish);
      say(item.rewatching ? `🔁 «${item.title}» vista otra vez` : `🎬 «${item.title}» marcada como vista`);
      return;
    }
    const prog = seriesProgress(item);
    if (!prog.next) return;
    const { season, ep } = prog.next;
    const willFinish = prog.seen + 1 === prog.total;
    patch(item.id, (i) => {
      const next = {
        ...i,
        status: ["watchlist", "paused", "dropped"].includes(i.status) ? "watching" : i.status,
        seasons: i.seasons.map((s, si) => (si === season - 1 ? { ...s, watched: ep } : s)),
      };
      return willFinish ? finish(next) : next;
    });
    say(
      willFinish
        ? item.rewatching ? `🔁 ¡Revisionado de «${item.title}» completado!` : `🏆 ¡«${item.title}» terminada!`
        : `✓ ${epLabel(prog.next)} de «${item.title}»`
    );
  };

  /* fija el último episodio visto con un toque (toggle si repites en el mismo) */
  const setEpisode = (item, seasonIdx, ep) => {
    const next = withLastEpisode(item, seasonIdx, ep);
    logActivity(next.seasons.reduce((n, s) => n + s.watched, 0) - seriesProgress(item).seen);
    const done = next.seasons.every((s) => s.watched === s.eps);
    patch(item.id, (i) =>
      done ? finish({ ...i, seasons: next.seasons })
        : { ...i, seasons: next.seasons, status: i.status === "watched" ? "watching" : i.status }
    );
  };

  /* revisionado: pelis suman al contador; series reinician el progreso sin perder el historial */
  const rewatch = (item) => {
    if (item.type === "movie") {
      logActivity(1);
      patch(item.id, (i) => ({ ...i, rewatches: (i.rewatches || 0) + 1, watchedAt: Date.now() }));
      say(`🔁 «${item.title}» vista otra vez`);
      return;
    }
    patch(item.id, (i) => ({
      ...i,
      status: "watching",
      rewatching: true,
      seasons: i.seasons.map((s) => ({ ...s, watched: 0 })),
    }));
    setDetailId(null);
    say(`🔁 Revisionado nº${(item.rewatches || 0) + 1} de «${item.title}» en marcha`);
  };

  const setStatus = (item, status) => {
    patch(item.id, (i) => {
      // marcar como vista completa todos los capítulos (y cierra el revisionado si lo había)
      if (status === "watched") {
        return finish({
          ...i,
          seasons: i.seasons ? i.seasons.map((s) => ({ ...s, watched: s.eps })) : i.seasons,
        });
      }
      return { ...i, status };
    });
    say(`Movida a «${STATUS[status].single}»`);
  };

  const addFromCatalog = async (c, status) => {
    let item = c;
    if (c.tmdbId) {
      // resultado online: traer temporadas/duración reales antes de guardar
      try { item = await hydrateTmdbItem(c, tmdbKey); }
      catch { /* si falla, se añade igualmente con lo que hay */ }
    }
    // una serie sin temporadas (trending, o hidratación fallida) rompería el progreso
    if (item.type === "series" && !item.seasons) item = { ...item, seasons: [{ eps: 8, watched: 0 }] };
    let entry = { ...item, id: ++nextId, status, addedAt: Date.now(), poster: { ...item.poster } };
    if (status === "watched") {
      entry = {
        ...entry,
        watchedAt: Date.now(),
        seasons: entry.seasons ? entry.seasons.map((s) => ({ ...s, watched: s.eps })) : entry.seasons,
      };
      logActivity(1);
    }
    setLib((L) => [entry, ...L]);
    say(status === "skipped" ? `🥢 «${entry.title}»: ni con un palo` : `＋ «${entry.title}» en «${STATUS[status].single}»`);
  };

  /* abrir un resultado de búsqueda: ficha real si ya está, preview si no */
  const openFromSearch = async (c) => {
    const existing = lib.find((i) => i.title === c.title && i.type === c.type);
    if (existing) { setDetailId(existing.id); return; }
    let item = c;
    if (c.tmdbId) {
      try { item = await hydrateTmdbItem(c, tmdbKey); } catch { /* preview con lo que hay */ }
    }
    if (item.type === "series" && !item.seasons) item = { ...item, seasons: [{ eps: 8, watched: 0 }] };
    setPreview({ ...item, status: undefined });
  };

  /* primera acción dentro de la preview ⇒ se guarda en la videoteca con esa acción hecha */
  const adopt = (c, status, mutate) => {
    let item = { ...c, id: ++nextId, status, addedAt: Date.now(), poster: { ...c.poster } };
    if (mutate) item = mutate(item);
    if (item.status === "watched") {
      // adoptada como ya vista: temporadas completas y fecha de visionado
      item = {
        ...item,
        watchedAt: Date.now(),
        seasons: item.seasons ? item.seasons.map((s) => ({ ...s, watched: s.eps })) : item.seasons,
      };
      logActivity(1);
    }
    setLib((L) => [item, ...L]);
    setPreview(null);
    setDetailId(item.id);
    const where = lastSeenLabel(item);
    say(
      item.status === "watching" && where
        ? `＋ «${item.title}» — te quedaste en ${where}`
        : `＋ «${item.title}» en «${STATUS[item.status].single}»`
    );
  };

  const adoptEpisode = (c, seasonIdx, ep) => {
    adopt(c, "watching", (item) => {
      const next = withLastEpisode(item, seasonIdx, ep);
      logActivity(next.seasons.reduce((n, s) => n + s.watched, 0));
      const done = next.seasons.every((s) => s.watched === s.eps);
      return done ? { ...next, status: "watched", watchedAt: Date.now() } : next;
    });
  };

  /* ruleta «¿qué veo hoy?»: un candidato al azar de tu «Por ver» */
  const surprise = () => {
    const pool = lib.filter((i) => i.status === "watchlist");
    if (pool.length === 0) { say("Tu «Por ver» está vacía 🎬"); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setDetailId(pick.id);
    say(`🎲 ¿Qué tal «${pick.title}»?`);
  };

  /* tarjeta para compartir (Web Share en móvil, descarga PNG en escritorio) */
  const doShare = async (item) => {
    try {
      const result = await shareCard(item, [item.img, posters[posterKey(item)]]);
      say(result === "shared" ? "📤 Tarjeta compartida" : "🖼️ Tarjeta descargada");
    } catch {
      say("No se pudo crear la tarjeta");
    }
  };

  /* hay episodios nuevos en TMDB: fusionar temporadas conservando tu progreso */
  const applyUpdate = (item) => {
    const remote = updates[posterKey(item)];
    if (!remote) return;
    patch(item.id, (i) => ({
      ...i,
      seasons: remote.map((eps, si) => ({ eps, watched: Math.min(i.seasons[si]?.watched ?? 0, eps) })),
      status: i.status === "watched" ? "paused" : i.status,
    }));
    setUpdates((u) => {
      const n = { ...u };
      delete n[posterKey(item)];
      return n;
    });
    say(`🎉 «${item.title}» actualizada con los episodios nuevos`);
  };

  /* Descubrir: candidatos que no están ya en tu videoteca */
  const notOwned = (cards) => {
    const have = new Set(lib.map((i) => `${i.type}:${i.title}`));
    return cards.filter((c) => !have.has(`${c.type}:${c.title}`));
  };

  const openDiscover = async () => {
    setDeck({ cards: notOwned(catalog), page: 0 });
    if (tmdbKey && !deckLoading.current) {
      deckLoading.current = true;
      try {
        const trending = await fetchTrending(tmdbKey, 1);
        setDeck({ cards: notOwned(trending), page: 1 });
      } catch { /* nos quedamos con el catálogo local */ }
      deckLoading.current = false;
    }
  };

  const deckMore = async () => {
    if (!tmdbKey || !deck || deckLoading.current) return;
    deckLoading.current = true;
    try {
      const trending = await fetchTrending(tmdbKey, deck.page + 1);
      setDeck((d) => {
        if (!d) return d;
        // el orden del trending baila entre páginas: sin esto salen cartas repetidas
        const seen = new Set(d.cards.map((c) => `${c.type}:${c.title}`));
        return { cards: [...d.cards, ...notOwned(trending).filter((c) => !seen.has(`${c.type}:${c.title}`))], page: d.page + 1 };
      });
    } catch { say("Sin conexión con TMDB"); }
    deckLoading.current = false;
  };

  const deckDecide = (card, dir) => {
    // siempre por addFromCatalog: hidrata TMDB (temporadas/duración) y normaliza
    // el título antes de guardarlo — una serie sin `seasons` rompería el render
    addFromCatalog(card, SWIPE[dir].status);
    setDeck((d) => d && { ...d, cards: d.cards.filter((c) => c !== card) });
    if (deck && deck.cards.length <= 3 && tmdbKey) deckMore();
  };

  const saveKey = (key) => {
    saveTmdbKey(key);
    setTmdbKey(key);
    say(key ? "🔑 TMDB conectado" : "TMDB desconectado");
  };

  const resetData = () => {
    try { localStorage.removeItem(LIB_KEY); } catch { /* nada */ }
    setLib(seedLibrary);
    say("Datos de ejemplo restablecidos");
  };

  const exportData = () => {
    const payload = { app: "butaca", version: 1, exportedAt: new Date().toISOString(), library: lib };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `butaca-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("💾 Copia exportada");
  };

  const importData = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : parsed.library;
      if (!Array.isArray(items)) throw new Error("formato");
      const valid = items.filter(
        (i) => i && typeof i.title === "string" &&
          (i.type === "movie" || i.type === "series") && i.status in STATUS
      );
      if (valid.length === 0) throw new Error("vacío");
      const imported = valid.map((i, idx) => ({
        ...i,
        id: idx + 1,
        poster: i.poster || { from: "#3b4863", to: "#0b0e16", emoji: i.type === "series" ? "📺" : "🎬" },
        seasons: i.type === "series"
          ? (Array.isArray(i.seasons) && i.seasons.length ? i.seasons : [{ eps: 8, watched: 0 }])
          : undefined,
      }));
      nextId = imported.length + 1;
      setLib(imported);
      say(`📥 ${imported.length} títulos importados`);
    } catch {
      say("⚠️ No se pudo leer el archivo");
    }
  };

  const remove = (item) => {
    setLib((L) => L.filter((i) => i.id !== item.id));
    setDetailId(null);
    say(`«${item.title}» eliminada`);
  };

  return (
    <PosterCtx.Provider value={posters}>
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-ink text-snow">
      <main className="flex-1">
        {tab === "home" && (
          <HomeView lib={lib} streak={streakOf(activity)}
            pausedNews={lib.filter((i) => i.status === "paused" && updates[posterKey(i)]).length}
            onAdvance={advance}
            onStart={(it) => { setStatus(it, "watching"); }}
            onOpen={setDetailId} onAdd={() => setAddOpen(true)}
            onPaused={() => { setSeriesTab("paused"); setTab("series"); }}
            onSurprise={surprise} onDiscover={openDiscover} />
        )}
        {tab === "movie" && (
          <LibraryView lib={lib} type="movie" tab={movieTab} onTab={setMovieTab} updates={updates}
            onOpen={setDetailId} onAdvance={advance} onResume={(it) => setStatus(it, "watching")} />
        )}
        {tab === "series" && (
          <LibraryView lib={lib} type="series" tab={seriesTab} onTab={setSeriesTab} updates={updates}
            onOpen={setDetailId} onAdvance={advance} onResume={(it) => setStatus(it, "watching")} />
        )}
        {tab === "stats" && (
          <StatsView lib={lib} activity={activity} tmdbKey={tmdbKey} onSaveKey={saveKey} onReset={resetData}
            onExport={exportData} onImport={importData} />
        )}
      </main>

      <TabBar tab={tab} onTab={setTab} onAdd={() => setAddOpen(true)} />

      {addOpen && (
        <AddSheet lib={lib} tmdbKey={tmdbKey} onClose={() => setAddOpen(false)}
          onAdd={addFromCatalog} onPreview={openFromSearch} />
      )}
      {deck && (
        <DiscoverDeck cards={deck.cards} canLoadMore={!!tmdbKey}
          onDecide={deckDecide} onLoadMore={deckMore} onClose={() => setDeck(null)} />
      )}
      {detail && (
        <DetailSheet
          item={detail}
          update={updates[posterKey(detail)]}
          onApplyUpdate={applyUpdate}
          onNote={(it, text) => patch(it.id, (i) => ({ ...i, note: text }))}
          onShare={doShare}
          onClose={() => setDetailId(null)}
          onSetStatus={setStatus}
          onSetEpisode={setEpisode}
          onAdvance={advance}
          onRate={(it, n) => patch(it.id, (i) => ({ ...i, rating: n }))}
          onRewatch={rewatch}
          onRemove={remove}
        />
      )}
      {preview && (
        <DetailSheet
          item={preview}
          preview
          onClose={() => setPreview(null)}
          onSetStatus={(it, s) => adopt(it, s)}
          onSetEpisode={adoptEpisode}
          onAdvance={() => {}}
          onRate={() => {}}
          onRewatch={() => {}}
          onRemove={() => {}}
        />
      )}

      {toast && (
        <div key={toast.key} className="animate-toast pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <p className="rounded-full bg-panel2 px-4 py-2.5 text-sm font-semibold text-snow shadow-2xl shadow-black/50 ring-1 ring-brass/30">
            {toast.msg}
          </p>
        </div>
      )}
    </div>
    </PosterCtx.Provider>
  );
}
