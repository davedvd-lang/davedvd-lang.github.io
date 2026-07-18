// Regresión: con el trending de la página 1 YA decidido entero (usuario
// intensivo), el deck antes se llenaba solo de clásicas. Ahora pasa páginas
// hasta traer estrenos frescos y los clásicos quedan en minoría.
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

// página 1 del trending: 20 pelis que el usuario YA tiene (sembradas abajo);
// página 2 en adelante: estrenos frescos
const owned = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i, media_type: "movie", title: `Ya Decidida ${i + 1}`,
  release_date: "2025-06-01", overview: "x", vote_average: 6.5, poster_path: "/o.jpg",
}));
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => {
  const page = new URL(r.request().url()).searchParams.get("page");
  r.fulfill({ json: { results: page === "1" ? owned : [
    { id: 21, media_type: "movie", title: "Estreno Fresco Uno", release_date: "2026-01-10", overview: "x", vote_average: 7, poster_path: "/1.jpg" },
    { id: 22, media_type: "movie", title: "Estreno Fresco Dos", release_date: "2025-09-05", overview: "x", vote_average: 7, poster_path: "/2.jpg" },
    { id: 23, media_type: "movie", title: "Estreno Fresco Tres", release_date: "2026-02-20", overview: "x", vote_average: 7, poster_path: "/3.jpg" },
  ] } });
});
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => {
  const from = new URL(r.request().url()).searchParams.get("primary_release_date.gte").slice(0, 4);
  r.fulfill({ json: { results: [
    { id: Number(from), title: `Joya de ${from}`, release_date: `${from}-05-01`, overview: "clásico", vote_average: 7.8, poster_path: "/c.jpg" },
  ] } });
});
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 110, genres: [{ name: "Drama" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

// videoteca sembrada: las 20 del trending p1 ya están decididas (vistas)
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
await page.waitForTimeout(1200);

// recorrer el mazo contando estrenos vs clásicas
const seen = { fresh: 0, classic: 0, other: 0 };
for (let i = 0; i < 10; i++) {
  const t = await topTitle().catch(() => null);
  if (!t) break;
  if (t.startsWith("Estreno Fresco")) seen.fresh += 1;
  else if (t.startsWith("Joya de")) seen.classic += 1;
  else seen.other += 1;
  const btn = page.getByRole("button", { name: "Ni con un palo" });
  if ((await btn.count()) === 0) break;
  await btn.click();
  await page.waitForTimeout(600);
}
console.log("   mazo visto:", JSON.stringify(seen));
ok("hay estrenos frescos en el mazo (antes: ninguno)", seen.fresh >= 3);
ok("ninguna repetida del trending ya decidido", seen.other === 0);
ok("los clásicos no dominan el mazo", seen.classic <= seen.fresh + 3);
ok("sin errores de render", errors.length === 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
