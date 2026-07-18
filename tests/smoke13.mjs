// Regresión: remakes con el mismo título ya no se confunden («Desafío total»
// 1990 vs 2012), tarjeta compartible de la watchlist («¡qué buena pinta!») y
// clásicos del deck rotando entre décadas distintas.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 861, media_type: "movie", title: "Desafío total", release_date: "1990-06-01", overview: "Schwarzenegger en Marte.", vote_average: 7.3, poster_path: "/t90.jpg" },
    { id: 64635, media_type: "movie", title: "Desafío total", release_date: "2012-08-03", overview: "El remake con Colin Farrell.", vote_average: 6.1, poster_path: "/t12.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 21, media_type: "movie", title: "Estreno Uno", release_date: "2026-01-10", overview: "x", vote_average: 7, poster_path: "/1.jpg" },
    { id: 22, media_type: "movie", title: "Estreno Dos", release_date: "2025-09-05", overview: "x", vote_average: 7, poster_path: "/2.jpg" },
    { id: 23, media_type: "movie", title: "Estreno Tres", release_date: "2026-02-20", overview: "x", vote_average: 7, poster_path: "/3.jpg" },
  ] } })
);
// cada época pedida devuelve una «joya» con su año en el título: así podemos
// comprobar que los clásicos del deck rotan entre décadas distintas
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => {
  const from = new URL(r.request().url()).searchParams.get("primary_release_date.gte").slice(0, 4);
  r.fulfill({ json: { results: [
    { id: Number(from), title: `Joya de ${from}`, release_date: `${from}-05-01`, overview: "clásico popular", vote_average: 7.8, poster_path: "/c.jpg" },
  ] } });
});
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 113, genres: [{ name: "Sci-Fi" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

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

// 1. dos «Desafío total»: añadir una NO marca la otra
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("desafío total");
await page.waitForTimeout(900);
ok("salen los dos remakes", (await page.getByText("Desafío total").count()) === 2);
await page.getByRole("button", { name: "Añadir Desafío total a Por ver" }).first().click();
await page.waitForTimeout(700);
ok("solo UNA marcada «En tu lista»", (await page.getByText("✓ En tu lista").count()) === 1);
ok("la otra sigue ofreciendo añadirse", (await page.getByRole("button", { name: "Añadir Desafío total a Por ver" }).count()) === 1);
await page.screenshot({ path: "shot13-remakes.png" });

// 2. tarjeta compartible desde la watchlist, con la nota de la crítica
await page.getByText("Desafío total").first().click();
await page.waitForTimeout(500);
ok("botón Compartir en un título por ver", (await page.getByRole("button", { name: /Compartir tarjeta/ }).count()) > 0);
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Compartir tarjeta/ }).click(),
]);
ok("tarjeta «¡qué buena pinta!» descargada", /^butaca-desaf.*\.png$/.test(dl.suggestedFilename()));
ok("tarjeta con contenido", readFileSync(await dl.path()).length > 20000);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(300);

// 3. los clásicos del deck rotan de década: dos seguidos nunca de la misma
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("1ª carta del trending", (await topTitle()) === "Estreno Uno");
const classics = [];
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: "Añadir a Por ver" }).click(); // decide la actual
  await page.waitForTimeout(700);
  const t = await topTitle(); // ahora toca una clásica
  if (t?.startsWith("Joya de")) classics.push(t);
  if (classics.length === 2) break;
  await page.getByRole("button", { name: "Ni con un palo" }).click(); // descarta la clásica
  await page.waitForTimeout(700);
}
ok(`dos clásicas de décadas distintas (${classics.join(" vs ")})`, classics.length === 2 && classics[0] !== classics[1]);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
