// Tanda «perfeccionando»: compartir series a medias (tarjeta con progreso),
// plataformas de streaming en la ficha (JustWatch vía TMDB) y reapertura de
// la sala cuando la tanda de 12 h ya expiró.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 94997, media_type: "tv", name: "La casa del dragón", first_air_date: "2022-08-21", overview: "La casa Targaryen, 200 años antes de Juego de Tronos.", vote_average: 8.4, poster_path: "/d.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) =>
  r.fulfill({ json: {
    genres: [{ name: "Fantasía" }], seasons: [{ season_number: 1, episode_count: 10 }],
    "watch/providers": { results: { ES: { flatrate: [{ provider_name: "Netflix" }, { provider_name: "HBO Max" }] } } },
  } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 170, genres: [{ name: "Crimen" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

// tanda de hace 13 h con el cupo agotado: debe haber expirado y la sala, abierta
await ctx.addInitScript(() => {
  if (!localStorage.getItem("butaca:deckquota:v1"))
    localStorage.setItem("butaca:deckquota:v1", JSON.stringify({ start: Date.now() - 13 * 36e5, count: 30 }));
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);

// 1. compartir una serie a medias (Severance, viendo T2)
await page.getByRole("button", { name: "Series" }).click();
await page.waitForTimeout(300);
await page.getByText("Severance").first().click();
await page.waitForTimeout(400);
ok("botón Compartir en serie en curso", (await page.getByRole("button", { name: /Compartir tarjeta/ }).count()) > 0);
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Compartir tarjeta/ }).click(),
]);
ok("tarjeta con progreso descargada", dl.suggestedFilename() === "butaca-severance.png");
ok("tarjeta con contenido", readFileSync(await dl.path()).length > 20000);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 2. tanda de 12 h expirada ⇒ la sala reabre con contador a cero
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("la sala reabrió (sin pantalla de cierre)", (await page.getByText("La sala cierra un rato").count()) === 0);
ok("cartas y botones disponibles", (await page.getByRole("button", { name: "Marcar como vista" }).count()) > 0);

// 3. plataformas de streaming en la ficha (toque en la carta del deck)
await page.getByRole("dialog").locator("div.touch-none").first().click({ position: { x: 150, y: 150 } });
await page.waitForTimeout(800);
ok("bloque «En streaming» en la ficha", (await page.getByText("En streaming:").count()) > 0);
ok("con las plataformas (Netflix, HBO Max)", (await page.getByText("Netflix").count()) > 0 && (await page.getByText("HBO Max").count()) > 0);
ok("con la atribución a JustWatch", (await page.getByText("datos de JustWatch").count()) > 0);
await page.screenshot({ path: "shot12-streaming.png" });

// 4. también en la ficha de un título ya en la videoteca (tras adoptarlo)
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(700);
ok("ficha real con «En streaming»", (await page.getByText("En streaming:").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
