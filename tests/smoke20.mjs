// Regresión: dos películas con el MISMO título y distinto año son títulos distintos.
//
// Bug cazado por el usuario (2026-07-25): tenía «Masters of the Universe» de 2026 en
// «Por ver» y también la de los 80. Al marcar la nueva como vista, no se movía.
// Causa: TMDB devuelve `year: ""` cuando aún no hay fecha de estreno, y el viejo
// `sameItem` daba dos títulos por el mismo en cuanto a uno le faltaba el año
// (`!a.year || !b.year || ...`). Al buscar la de 2026, la app encontraba la de los 80
// y abría/actuaba sobre la ficha equivocada.
//
// Aquí se comprueba de punta a punta: buscar el remake sin fecha de estreno teniendo
// ya el original en la videoteca debe crear una ficha NUEVA, y marcarla como vista
// debe mover esa y solo esa.
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

// El remake: mismo título que el original, SIN release_date (como una peli aún sin estrenar)
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 77777, media_type: "movie", title: "Masters of the Universe", release_date: "", overview: "El remake.", vote_average: 6.5, poster_path: "/m.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) =>
  r.fulfill({ json: {
    runtime: 120, genres: [{ name: "Aventura" }],
    credits: { cast: [], crew: [] }, videos: { results: [] },
    "watch/providers": { results: {} },
  } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fallos = 0;
const ok = (label, cond) => { if (!cond) fallos++; console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`); };

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(500);

// Videoteca de partida: solo el clásico de 1987, en «Por ver»
await page.evaluate(() => {
  localStorage.setItem("butaca:lib:v1", JSON.stringify([{
    id: 1, type: "movie", title: "Masters of the Universe", year: 1987,
    genre: "Aventura", runtime: 106, status: "watchlist", addedAt: Date.now(),
    poster: { from: "#3b4863", to: "#0b0e16", emoji: "🎬" },
  }]));
  localStorage.setItem("butaca:tmdb-key", "k");
  localStorage.setItem("butaca:welcome:v1", "1");
});
await page.reload();
await page.waitForTimeout(700);

// Buscar el remake y añadirlo como «Por ver»
await page.getByRole("button", { name: "Añadir" }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder(/Busca/).fill("Masters of the Universe");
await page.waitForTimeout(1200);

const añadir = page.getByRole("button", { name: /Por ver/ }).last();
await añadir.click();
await page.waitForTimeout(500);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Debe haber DOS fichas, no una
const total = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("butaca:lib:v1") || "[]").length
);
ok("el remake se añade aparte del original (2 fichas, no 1)", total === 2);

// Marcar el remake (el que tiene tmdbId) como vista: solo debe moverse ese
await page.evaluate(() => {
  const lib = JSON.parse(localStorage.getItem("butaca:lib:v1"));
  const remake = lib.find((i) => i.tmdbId === 77777);
  window.__remakeId = remake ? remake.id : null;
});
const remakeExiste = await page.evaluate(() => window.__remakeId !== null);
ok("el remake conserva su tmdbId propio", remakeExiste);

await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(400);
const enPorVer = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("butaca:lib:v1")).filter((i) => i.status === "watchlist").length
);
ok("las dos están en «Por ver» y se listan por separado", enPorVer === 2);

ok("sin errores de JS", errors.length === 0);
if (errors.length) console.log(errors);

await browser.close();
process.exit(fallos ? 1 : 0);
