// Atribución de marca: logo de TMDB (además del descargo de texto) en Stats,
// enlazado a themoviedb.org; y JustWatch como enlace en el bloque «En streaming».
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 500, media_type: "movie", title: "Coherence Online", release_date: "2013-09-19", overview: "x", vote_average: 7.0, poster_path: "/c.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) =>
  r.fulfill({ json: {
    runtime: 89, genres: [{ name: "Sci-Fi" }],
    credits: { cast: [{ name: "Emily Baldoni" }], crew: [{ job: "Director", name: "James Ward Byrkit" }] },
    videos: { results: [] },
    "watch/providers": { results: { ES: { flatrate: [{ provider_name: "Filmin" }] } } },
  } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);

// 1. logo de TMDB + descargo, enlazado a themoviedb.org
const logo = page.getByRole("img", { name: /The Movie Database/ });
ok("logo de TMDB visible en Stats", (await logo.count()) > 0);
ok("descargo de texto sigue estando", (await page.getByText(/not endorsed or certified by TMDB/).count()) > 0);
const tmdbLink = page.getByRole("link", { name: "The Movie Database" });
ok("el logo enlaza a themoviedb.org", (await tmdbLink.getAttribute("href")) === "https://www.themoviedb.org/");
await page.screenshot({ path: "shot19-tmdb.png" });

// 2. el texto sigue revelando la config de clave (doble función intacta)
await page.getByText(/not endorsed or certified by TMDB/).click();
await page.waitForTimeout(300);

// 3. JustWatch como enlace en «En streaming» de una ficha
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("coherence");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Ver ficha de Coherence Online" }).click();
await page.waitForTimeout(800);
const jw = page.getByRole("link", { name: /datos de JustWatch/ });
ok("JustWatch es un enlace en la ficha", (await jw.count()) > 0);
ok("JustWatch enlaza a justwatch.com", (await jw.getAttribute("href")) === "https://www.justwatch.com/");

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
