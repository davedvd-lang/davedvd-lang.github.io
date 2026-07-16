// Regresión: swipe ⬅ «ni con un palo» sobre una SERIE del trending de TMDB.
// Antes se guardaba sin `seasons` y el dashboard reventaba en pleno render
// (app congelada, había que cerrarla y abrirla). Reproduce el caso reportado
// con «La casa del dragón».
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

// sin clásicos en este smoke: discover vacío para que no salga a red real
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 94997, media_type: "tv", name: "La casa del dragón", first_air_date: "2022-08-21", overview: "La casa Targaryen, 200 años antes de Juego de Tronos.", poster_path: "/d.jpg" },
    { id: 91, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "Un ladrón meticuloso y un detective obsesivo.", poster_path: "/h.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) =>
  r.fulfill({ json: { genres: [{ name: "Fantasía" }], seasons: [
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

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);

// clave TMDB para que Descubrir use el trending
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);

// 1. el deck sale con la serie del trending como primera carta
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("deck con «La casa del dragón» (serie trending)", (await page.getByRole("dialog").getByText("La casa del dragón").count()) > 0);

// 2. swipe ⬅ (botón «Ni con un palo») sobre la serie: antes esto congelaba la app
await page.getByRole("button", { name: "Ni con un palo" }).click();
await page.waitForTimeout(900);
ok("toast 🥢 tras descartar la serie", (await page.getByText("🥢 «La casa del dragón»: ni con un palo").count()) > 0);
ok("sin errores de render tras el swipe", errors.length === 0);

// 3. la app sigue viva: el dashboard de detrás responde
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);
ok("dashboard vivo tras cerrar el deck", (await page.getByText("¿Qué toca hoy?").count()) > 0);

// 4. la serie quedó en «Ni con un palo» con sus temporadas reales
await page.getByRole("button", { name: "Series" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Ni con un palo/ }).click();
await page.waitForTimeout(300);
ok("«La casa del dragón» en la pestaña Ni con un palo", (await page.getByText("La casa del dragón").count()) > 0);
await page.getByText("La casa del dragón").first().click();
await page.waitForTimeout(400);
ok("ficha con temporadas hidratadas (T1+T2 = 18 caps)", (await page.getByText("0/18 capítulos · toca el último visto").count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shot9-skipped-series.png" });

// 5. persiste tras reabrir la app y ya no vuelve a salir en el deck
await page.reload();
await page.waitForTimeout(700);
ok("la app arranca sin errores tras reabrir", errors.length === 0 && (await page.getByText("¿Qué toca hoy?").count()) > 0);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("«La casa del dragón» ya no aparece en el deck", (await page.getByRole("dialog").getByText("La casa del dragón").count()) === 0);
ok("el deck sigue ofreciendo el resto del trending (Heat)", (await page.getByRole("dialog").getByText("Heat").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
