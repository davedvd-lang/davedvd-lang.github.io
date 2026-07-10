import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// TMDB simulado para probar la preview de un resultado online
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 42, media_type: "tv", name: "Breaking Bad", first_air_date: "2008-01-20", overview: "Un profesor de química con cáncer empieza a cocinar metanfetamina.", poster_path: null },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/tv/42**", (r) =>
  r.fulfill({ json: { seasons: [ { season_number: 1, episode_count: 7 }, { season_number: 2, episode_count: 13 } ] } })
);
await ctx.route(/(tvmaze|itunes|image\.tmdb)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);

// 1. preview desde el catálogo local: tocar resultado → ficha con sinopsis y capítulos
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(400);
await page.getByPlaceholder("Busca una peli o serie…").fill("true detective");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Ver ficha de True Detective" }).click();
await page.waitForTimeout(500);
ok("preview: sinopsis visible", (await page.getByText(/Antología criminal/).count()) > 0);
ok("preview: aviso «aún no está en tu videoteca»", (await page.getByText(/Aún no está en tu videoteca/).count()) > 0);
ok("preview: temporadas visibles", (await page.getByText("Temporada 4").count()) > 0);
ok("preview: sin botón eliminar", (await page.getByText("Eliminar de mi videoteca").count()) === 0);
await page.screenshot({ path: "shot5-preview.png" });

// 2. tocar T1·E5 en la preview → se añade como Viendo con ese progreso
await page.getByRole("button", { name: "Episodio 5 temporada 1" }).click();
await page.waitForTimeout(500);
ok("adopción: toast con el progreso", (await page.getByText(/te quedaste en T1·E5/).count()) > 0);
ok("adopción: la ficha real se abre (botón eliminar presente)", (await page.getByText("Eliminar de mi videoteca").count()) > 0);
ok("adopción: siguiente capítulo T1·E6", (await page.getByText(/Marcar T1·E6 como vista/).count()) > 0);
await page.screenshot({ path: "shot5-adopted.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(400);
ok("al cerrar vuelve al buscador con «En tu lista»", (await page.getByText("✓ En tu lista").count()) > 0);

// 3. preview de peli → chip «Vista» directo → ficha real con estrellas
await page.getByPlaceholder("Busca una peli o serie…").fill("padrino");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Ver ficha de El Padrino" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(500);
const stars = page.getByRole("dialog").filter({ hasText: "El Padrino" }).getByLabel("5 estrellas");
ok("peli adoptada como Vista, estrellas disponibles", (await stars.count()) > 0);
await stars.click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shot5-movie-rated.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 4. resultado online (TMDB simulado): preview con temporadas reales hidratadas
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("breaking");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Ver ficha de Breaking Bad" }).click();
await page.waitForTimeout(700);
ok("preview online: temporadas reales (0/13 en T2)", (await page.getByText("0/13").count()) > 0);
await page.getByRole("button", { name: "Por ver", exact: true }).click();
await page.waitForTimeout(400);
ok("online adoptada en Por ver", (await page.getByText(/«Breaking Bad» en «Por ver»/).count()) > 0);

// 5. resultado ya en videoteca → abre la ficha real directamente
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("breaking");
await page.waitForTimeout(900);
ok("resultado ya añadido marcado «En tu lista»", (await page.getByText("✓ En tu lista").count()) > 0);
await page.getByRole("button", { name: "Ver ficha de Breaking Bad" }).click();
await page.waitForTimeout(500);
ok("ya en videoteca → ficha real", (await page.getByText("Eliminar de mi videoteca").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
