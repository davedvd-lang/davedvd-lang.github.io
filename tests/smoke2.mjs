import { chromium } from "playwright-core";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];

// Red simulada: TVmaze, iTunes, TMDB e imágenes
await ctx.route("**/api.tvmaze.com/**", (r) =>
  r.fulfill({ json: { image: { medium: "https://static.tvmaze.com/poster.png" } } })
);
await ctx.route("**/itunes.apple.com/**", (r) =>
  r.fulfill({ json: { results: [{ artworkUrl100: "https://is1.mzstatic.com/img/100x100bb.jpg", releaseDate: "2024-03-01" }] } })
);
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 42, media_type: "tv", name: "Breaking Bad", first_air_date: "2008-01-20", overview: "Un profesor de química con cáncer empieza a cocinar metanfetamina.", poster_path: "/bb.jpg" },
    { id: 43, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "Un ladrón meticuloso y un detective obsesivo, cara a cara en Los Ángeles.", poster_path: "/heat.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/tv/42**", (r) =>
  r.fulfill({ json: { seasons: [
    { season_number: 0, episode_count: 3 },
    { season_number: 1, episode_count: 7 },
    { season_number: 2, episode_count: 13 },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/search/tv**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/search/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route(/(static\.tvmaze\.com|is1\.mzstatic\.com|image\.tmdb\.org)/, (r) =>
  r.fulfill({ contentType: "image/png", body: PNG_1x1 })
);

const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const url = "file://" + process.cwd() + "/dist/index.html?demo";

await page.goto(url);
await page.waitForTimeout(1500);
const imgs = await page.locator("img").count();
console.log("carátulas cargadas en Hoy:", imgs);

// sinopsis en la ficha
await page.getByText("Severance").first().click();
await page.waitForTimeout(400);
const hasSynopsis = await page.getByText(/empleados de Lumon/).count();
console.log("sinopsis en ficha:", hasSynopsis > 0);
await page.screenshot({ path: "shot2-detail.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();

// persistencia: marcar episodio y recargar
await page.getByRole("button", { name: /T2·E7 vista/ }).first().click();
await page.waitForTimeout(300);
await page.reload();
await page.waitForTimeout(1000);
const persisted = await page.getByRole("button", { name: /T2·E8 vista/ }).count();
console.log("persistencia tras recarga:", persisted > 0);

// conectar TMDB en Stats
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Pega aquí tu API key…").fill("test-key-123");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
console.log("TMDB conectado:", (await page.getByText("✓ Conectado a TMDB").count()) > 0);
await page.screenshot({ path: "shot2-stats.png" });

// búsqueda online
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("breaking");
await page.waitForTimeout(900);
await page.screenshot({ path: "shot2-search.png" });
console.log("resultado online visible:", (await page.getByText("Breaking Bad").count()) > 0);

// añadir serie online → temporadas reales (7 + 13, sin especiales)
await page.getByRole("button", { name: /Añadir Breaking Bad a Viendo/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.getByRole("button", { name: "Series" }).last().click();
await page.waitForTimeout(400);
await page.getByText("Breaking Bad").first().click();
await page.waitForTimeout(500);
const t1 = await page.getByText("Temporada 1").count();
const t2 = await page.getByText("Temporada 2").count();
const zero = await page.getByText("0/7").count();
const zero2 = await page.getByText("0/13").count();
console.log("temporadas reales desde TMDB:", t1 > 0 && t2 > 0 && zero > 0 && zero2 > 0);
await page.screenshot({ path: "shot2-bb.png" });

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
