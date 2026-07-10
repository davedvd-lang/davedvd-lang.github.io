import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

// TMDB simulado: Breaking Bad con 2 temporadas al añadir, 3 al re-comprobar
let tvCalls = 0;
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 42, media_type: "tv", name: "Breaking Bad", first_air_date: "2008-01-20", overview: "Un profesor de química se pasa al lado oscuro.", poster_path: null },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/tv/42**", (r) => {
  tvCalls++;
  const seasons = [{ season_number: 1, episode_count: 7 }, { season_number: 2, episode_count: 13 }];
  if (tvCalls > 1) seasons.push({ season_number: 3, episode_count: 13 });
  r.fulfill({ json: { genres: [{ name: "Crimen" }, { name: "Drama" }], seasons } });
});
await ctx.route(/(tvmaze|itunes|image\.tmdb)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);
const URL = "file://" + process.cwd() + "/dist/index.html";

await page.goto(URL);
await page.waitForTimeout(700);

// 1. actividad + racha: marcar un capítulo crea racha de 1 día y «este año» ya cuenta seeds
await page.getByRole("button", { name: /T2·E7 vista/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
ok("«Vistas en 2026» cuenta las 4 de ejemplo", (await page.getByText("Vistas en 2026").count()) > 0);
ok("racha de 1 día tras marcar capítulo", (await page.getByText("1 día", { exact: true }).count()) > 0);
ok("nota media visible", (await page.getByText(/★ 4\.\d/).count()) > 0);
ok("récord del día = 1 cap", (await page.getByText("1 caps").count()) > 0);
ok("podio con medalla de oro", (await page.getByText("🥇").count()) > 0);
await page.screenshot({ path: "shot7-stats.png" });

// 2. ruleta Sorpréndeme
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Sorpréndeme/ }).click();
await page.waitForTimeout(500);
const sheetOpen = (await page.getByRole("dialog").count()) > 0;
ok("ruleta abre una ficha", sheetOpen);
const toastRoulette = (await page.getByText(/🎲 ¿Qué tal/).count()) > 0;
ok("toast de la ruleta", toastRoulette);
await page.screenshot({ path: "shot7-roulette.png" });

// 3. nota privada persistente
const noteBox = page.getByPlaceholder(/Solo para ti/);
ok("campo de nota privada en la ficha", (await noteBox.count()) > 0);
await noteBox.fill("verla con María");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);
await page.reload();
await page.waitForTimeout(800);

// 4. compartir tarjeta (escritorio → descarga PNG)
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Vistas/ }).click();
await page.waitForTimeout(300);
await page.getByText("Whiplash").first().click();
await page.waitForTimeout(400);
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Compartir tarjeta/ }).click(),
]);
ok(`tarjeta descargada: ${dl.suggestedFilename()}`, dl.suggestedFilename() === "butaca-whiplash.png");
const pngPath = await dl.path();
ok("la tarjeta es un PNG con contenido", readFileSync(pngPath).length > 20000);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 5. filtro por género (pelis, Vistas: Thriller → solo Parásitos)
await page.getByRole("button", { name: "Thriller", exact: true }).click();
await page.waitForTimeout(300);
const shown = await page.locator(".grid p.truncate.text-xs").allTextContents();
ok(`género Thriller filtra: ${shown.join(", ")}`, shown.length === 1 && shown[0] === "Parásitos");
await page.getByRole("button", { name: "Todos", exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: "shot7-genre.png" });

// 6. aviso de nueva temporada: añadir BB (2 temporadas), pausarla, recargar (TMDB devuelve 3)
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("breaking");
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Añadir Breaking Bad a Viendo/ }).click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Series" }).last().click();
await page.waitForTimeout(300);
await page.getByText("Breaking Bad").first().click();
await page.waitForTimeout(400);
ok("género real desde TMDB (Crimen · Drama)", (await page.getByText("Crimen · Drama").count()) > 0);
await page.getByRole("button", { name: "En pausa", exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(200);

// caducar el caché diario para forzar re-chequeo al recargar
await page.evaluate(() => {
  const c = JSON.parse(localStorage.getItem("butaca:tvcheck:v1") || "{}");
  for (const k in c) c[k].ts = 0;
  localStorage.setItem("butaca:tvcheck:v1", JSON.stringify(c));
});
await page.reload();
await page.waitForTimeout(1200);
ok("atajo del dashboard avisa de episodios nuevos", (await page.getByText(/con episodios nuevos/).count()) > 0);
await page.getByText(/en pausa/).first().click();
await page.waitForTimeout(400);
ok("tarjeta pausada marca «🎉 ¡Episodios nuevos!»", (await page.getByText("🎉 ¡Episodios nuevos!").count()) > 0);
await page.screenshot({ path: "shot7-news.png" });
await page.getByText("Breaking Bad").first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /actualizar temporadas/ }).click();
await page.waitForTimeout(400);
ok("temporada 3 añadida (0/13)", (await page.getByText("Temporada 3").count()) > 0);
ok("progreso previo conservado (aviso desaparece)", (await page.getByText(/actualizar temporadas/).count()) === 0);
await page.screenshot({ path: "shot7-updated.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();

// 7. la nota privada sobrevivió a la recarga
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
const noted = await page.evaluate(() => localStorage.getItem("butaca:lib:v1").includes("verla con María"));
ok("nota privada persistida", noted);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
