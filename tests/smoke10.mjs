// Descubrir v2: toque en la carta = ficha completa (preview) desde el deck,
// nota de TMDB (★) en carta/ficha/buscador, y atribución TMDB en Stats.
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 94997, media_type: "tv", name: "La casa del dragón", first_air_date: "2022-08-21", overview: "La casa Targaryen, 200 años antes de Juego de Tronos.", vote_average: 8.41, poster_path: "/d.jpg" },
    { id: 91, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "Un ladrón meticuloso y un detective obsesivo.", vote_average: 7.9, poster_path: "/h.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 251, media_type: "movie", title: "Hércules", release_date: "1997-06-27", overview: "El héroe de Disney.", vote_average: 7.1, poster_path: "/hm.jpg" },
    { id: 251, media_type: "tv", name: "Hércules", first_air_date: "1995-01-16", overview: "Los viajes legendarios.", vote_average: 6.4, poster_path: "/ht.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) =>
  r.fulfill({ json: { genres: [{ name: "Fantasía" }, { name: "Drama" }], seasons: [
    { season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 8 },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 170, genres: [{ name: "Crimen" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(700);

// clave TMDB + atribución obligatoria visible en Stats
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
ok("atribución TMDB en Stats", (await page.getByText(/This product uses the TMDB API/).count()) > 0);
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);

// 1. la carta del deck luce la nota de TMDB (redondeada a un decimal)
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("carta con ★ 8.4 de TMDB", (await page.getByRole("dialog").getByText("8.4", { exact: true }).count()) > 0);

// 2. toque (sin arrastre) sobre la carta ⇒ se levanta la ficha completa
const card = page.getByRole("dialog").locator("div.touch-none").first();
await card.click({ position: { x: 150, y: 150 } });
await page.waitForTimeout(700);
ok("ficha preview abierta desde el deck", (await page.getByText("Aún no está en tu videoteca").count()) > 0);
ok("ficha con géneros hidratados y nota", (await page.getByText(/Fantasía · Drama/).count()) > 0 && (await page.getByText(/★ 8.4 en TMDB/).count()) > 0);
ok("ficha con sinopsis", (await page.getByText(/200 años antes de Juego de Tronos/).count()) > 0);
await page.screenshot({ path: "shot10-deck-ficha.png" });

// 3. decidir desde la ficha: «Vista» la adopta y su carta sale del deck
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(700);
ok("adoptada como vista desde la ficha", (await page.getByText("«La casa del dragón» en «Vista»").count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(400);
ok("su carta ya no está en el deck", (await page.getByRole("dialog").getByText("La casa del dragón").count()) === 0);
ok("la siguiente carta (Heat) queda arriba", (await page.getByRole("dialog").getByText("Heat").count()) > 0);

// 4. un arrastre de verdad sigue decidiendo sin abrir la ficha
const box = await page.getByRole("dialog").locator("div.touch-none").first().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(700);
ok("swipe ⬅ sigue funcionando (Heat descartada)", (await page.getByText("🥢 «Heat»: ni con un palo").count()) > 0);
ok("el arrastre no abrió la ficha", (await page.getByText("Aún no está en tu videoteca").count()) === 0);
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);

// 5. buscador online: nota ★ en los resultados y sin choque de claves peli/serie (Hércules)
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("hércules");
await page.waitForTimeout(900);
ok("resultados con ambos Hércules (peli y serie, mismo id TMDB)", (await page.getByText("Hércules").count()) === 2);
ok("resultado con nota ★ 7.1", (await page.getByText("★ 7.1").count()) > 0);
await page.screenshot({ path: "shot10-buscador.png" });

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
