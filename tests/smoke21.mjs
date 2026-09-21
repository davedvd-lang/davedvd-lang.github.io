// Descubrir: botón «Deshacer» de la última decisión, y arreglo del «Cargar más»
// que antes había que pulsar muchas veces (cada pulsación avanzaba UNA página y,
// con cientos de títulos ya decididos, esa página venía entera filtrada).
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

// Trending: las páginas 1–5 traen SOLO títulos que el usuario ya decidió (se
// filtran enteras). La primera con material nuevo es la 6 — el caso reportado.
const owned = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i, media_type: "movie", title: `Ya Decidida ${i + 1}`,
  release_date: "2025-06-01", overview: "x", vote_average: 6.5, poster_path: "/o.jpg",
}));
let trendingCalls = 0;
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => {
  trendingCalls += 1;
  const page = Number(new URL(r.request().url()).searchParams.get("page"));
  r.fulfill({ json: { results: page <= 5 ? owned : [
    { id: 900 + page, media_type: "movie", title: `Novedad P${page}`, release_date: "2026-05-01", overview: "x", vote_average: 7.4, poster_path: "/n.jpg" },
  ] } });
});
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 110, genres: [{ name: "Drama" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

// videoteca con las 20 de las páginas 1-5 ya decididas (usuario de meses)
await ctx.addInitScript(() => {
  if (localStorage.getItem("butaca:lib:v1")) return;
  const lib = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, type: "movie", title: `Ya Decidida ${i + 1}`, year: 2025, tmdbId: 100 + i,
    genre: "Drama", status: "watched", watchedAt: Date.now(), addedAt: Date.now(),
    poster: { from: "#3b4863", to: "#0b0e16", emoji: "🎬" },
  }));
  localStorage.setItem("butaca:lib:v1", JSON.stringify(lib));
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);
const topTitle = () => page.getByRole("dialog").locator("p.text-xl").first().textContent();

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(2500);

// 1. una sola apertura atraviesa las páginas vacías y llega al material nuevo
ok("el deck se llena solo pese a 5 páginas filtradas", (await topTitle() || "").startsWith("Novedad"));
ok("pasó de la página 5 sin que el usuario insista", trendingCalls >= 6);
await page.screenshot({ path: "shot20-deck.png" });

// 2. sin decisiones aún, no hay nada que deshacer
ok("sin «Deshacer» antes de decidir", (await page.getByRole("button", { name: /Deshacer/ }).count()) === 0);

// 3. decisión equivocada: «Vista» y deshacer
const antes = await topTitle();
await page.getByRole("button", { name: "Marcar como vista" }).click();
await page.waitForTimeout(900);
ok("la carta se fue tras decidir", (await topTitle()) !== antes);
const undo = page.getByRole("button", { name: /Deshacer/ });
ok("aparece el botón «Deshacer» arriba", (await undo.count()) > 0);
await page.screenshot({ path: "shot20-undo.png" });
await undo.click();
await page.waitForTimeout(900);
ok("la carta vuelve al mazo, arriba", (await topTitle()) === antes);
ok("avisa de que se ha deshecho", (await page.getByText(/vuelve al mazo/).count()) > 0);
ok("el botón «Deshacer» desaparece tras usarlo", (await page.getByRole("button", { name: /Deshacer/ }).count()) === 0);

// 4. y NO quedó guardada en la videoteca
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Vistas/ }).click();
await page.waitForTimeout(400);
ok("lo deshecho no está en «Vistas»", (await page.getByText(antes, { exact: true }).count()) === 0);

// 5. deshacer también devuelve el turno del cupo
const cupo = await page.evaluate(() => JSON.parse(localStorage.getItem("butaca:deckquota:v1") || "{}").count);
ok(`el turno se devolvió al cupo (count=${cupo})`, cupo === 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
