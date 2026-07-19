// Fechas de estreno: en pelis, línea de estreno en la ficha (futuro y pasado);
// en series, toque LARGO sobre un episodio = fecha de emisión (el corto sigue
// marcando visto).
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 61, media_type: "movie", title: "Estreno Futuro", release_date: "2027-03-12", overview: "Aún no ha salido.", vote_average: 0, poster_path: "/f.jpg" },
    { id: 62, media_type: "movie", title: "Peli Antigua", release_date: "1999-10-15", overview: "Ya estrenada.", vote_average: 7.7, poster_path: "/a.jpg" },
    { id: 94997, media_type: "tv", name: "La casa del dragón", first_air_date: "2022-08-21", overview: "Targaryen.", vote_average: 8.4, poster_path: "/d.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 120, genres: [{ name: "Drama" }] } }));
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) =>
  r.fulfill({ json: { genres: [{ name: "Fantasía" }], seasons: [{ season_number: 1, episode_count: 3 }] } })
);
// fechas por episodio de la T1: dos emitidos, uno en el futuro
await ctx.route("**/api.themoviedb.org/3/tv/94997/season/1**", (r) =>
  r.fulfill({ json: { episodes: [
    { episode_number: 1, air_date: "2022-08-21" },
    { episode_number: 2, air_date: "2022-08-28" },
    { episode_number: 3, air_date: "2027-06-01" },
  ] } })
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

// 1. peli aún sin estrenar: «Se estrena el …»
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("estreno");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Ver ficha de Estreno Futuro" }).click();
await page.waitForTimeout(700);
ok("peli futura: «Se estrena el 12 de marzo de 2027»", (await page.getByText("Se estrena el 12 de marzo de 2027").count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 2. peli ya estrenada: «Estreno: …»
await page.getByRole("button", { name: "Ver ficha de Peli Antigua" }).click();
await page.waitForTimeout(700);
ok("peli pasada: «Estreno: 15 de octubre de 1999»", (await page.getByText("Estreno: 15 de octubre de 1999").count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 3. serie: toque largo en un episodio ⇒ fecha; toque corto ⇒ marcar visto
await page.getByPlaceholder("Busca una peli o serie…").fill("casa del dragón");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Ver ficha de La casa del dragón" }).click();
await page.waitForTimeout(700);
ok("pista «mantén: fecha» en la rejilla", (await page.getByText(/mantén: fecha/).count()) > 0);

const ep2 = page.getByRole("button", { name: "Episodio 2 temporada 1" });
let box = await ep2.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(650);
await page.mouse.up();
await page.waitForTimeout(400);
const badge = page.getByText("🗓️ T1·E2 se emitió el 28 de agosto de 2022");
ok("toque largo: «se emitió el 28 de agosto de 2022»", (await badge.count()) > 0);
const badgeBox = await badge.boundingBox();
ok("la fecha sale ARRIBA, sobre el póster (no bajo el dedo)", badgeBox && badgeBox.y < 200);
ok("el toque largo NO marcó el episodio", (await page.getByText("0/3 capítulos", { exact: false }).count()) > 0);
await page.waitForTimeout(3500);
ok("sigue visible pasados 3,5 s (antes moría a los 2,2 s)", (await badge.count()) > 0);
await page.screenshot({ path: "shot18-fecha-ep.png" });

const ep3 = page.getByRole("button", { name: "Episodio 3 temporada 1" });
box = await ep3.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(650);
await page.mouse.up();
await page.waitForTimeout(400);
ok("episodio futuro: «sale el 1 de junio de 2027»", (await page.getByText("🗓️ T1·E3 sale el 1 de junio de 2027").count()) > 0);
ok("y sustituye a la fecha anterior", (await page.getByText("🗓️ T1·E2 se emitió", { exact: false }).count()) === 0);

// toque corto normal: adopta la serie con E2 como último visto
await ep2.click();
await page.waitForTimeout(600);
ok("toque corto sigue marcando (adoptada en T1·E2)", (await page.getByText(/te quedaste en T1·E2/).count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
