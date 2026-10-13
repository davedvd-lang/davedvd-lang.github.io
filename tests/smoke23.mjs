// Regresión (reportado por el usuario, 2026-10): una peli en «Por ver» que meses
// después vio y puntuó seguía apareciendo en el buscador con el distintivo
// «✓ En tu lista», que se lee como «está en mi lista de pendientes» (como «Mi lista»
// de Netflix). Dentro de la ficha sí estaba como vista: el fallo era el distintivo,
// que no decía el estado real. Ahora dice «Vista ★4», «Por ver», «Viendo T1·E3»…
import { chromium } from "playwright-core";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) => {
  const q = new URL(r.request().url()).searchParams.get("query").toLowerCase();
  const all = [
    { id: 949, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "Atracos en L.A.", vote_average: 7.9, poster_path: "/h.jpg" },
    { id: 1398, media_type: "tv", name: "Los Soprano", first_air_date: "1999-01-10", overview: "Tony.", vote_average: 8.6, poster_path: "/s.jpg" },
  ];
  r.fulfill({ json: { results: all.filter((x) => (x.title || x.name).toLowerCase().includes(q)) } });
});
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 170, genres: [{ name: "Crimen" }], credits: { cast: [], crew: [] }, videos: { results: [] }, "watch/providers": { results: {} } } }));
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) => r.fulfill({ json: { genres: [{ name: "Drama" }], seasons: [{ season_number: 1, episode_count: 13 }], credits: { cast: [], crew: [] }, videos: { results: [] }, "watch/providers": { results: {} } } }));
await ctx.route(/(discover|trending)/, (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fallos = 0;
const ok = (label, cond) => { if (!cond) fallos++; console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`); };

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(400);
await page.evaluate(() => {
  localStorage.setItem("butaca:welcome:v1", "1");
  localStorage.setItem("butaca:tmdb-key", "k");
});
await page.reload();
await page.waitForTimeout(600);

const buscar = async (texto) => {
  await page.getByPlaceholder("Busca una peli o serie…").fill(texto);
  await page.waitForTimeout(900);
};
const fila = (titulo) => page.locator("div.rounded-2xl.bg-panel2").filter({ has: page.getByText(titulo, { exact: true }) }).first();

// 1. el recorrido del usuario: buscar → «Por ver»
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await buscar("heat");
await page.getByRole("button", { name: "Añadir Heat a Por ver" }).click();
await page.waitForTimeout(700);
ok("1. recién añadida, el distintivo dice «Por ver»", /Por ver/.test(await fila("Heat").innerText()));
ok("   y ya no ofrece los botones de añadir", (await page.getByRole("button", { name: "Añadir Heat a Por ver" }).count()) === 0);

// 2. meses después: la ve y la puntúa desde la ficha
await page.getByRole("button", { name: "Ver ficha de Heat" }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(500);
await page.locator(".animate-toast").getByRole("button", { name: "4 estrellas" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(400);

// 3. vuelve a buscarla: el distintivo tiene que decir la verdad
await buscar("hea");
await buscar("heat");
const texto = await fila("Heat").innerText();
ok(`2. tras verla, el distintivo dice «Vista» (dice: ${JSON.stringify(texto.split("\n").pop())})`, /Vista/.test(texto));
ok("   con su nota (★ 4)", /★\s?4/.test(texto));
ok("   y ni rastro de «Por ver» ni de «En tu lista»", !/Por ver|En tu lista/.test(texto.split("\n").slice(-2).join(" ")));
await page.screenshot({ path: "shot23-vista.png" });

// 4. una serie a medias dice por dónde vas
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const lib = JSON.parse(localStorage.getItem("butaca:lib:v1"));
  lib.unshift({ id: 99, type: "series", title: "Los Soprano", year: 1999, tmdbId: 1398, genre: "Drama", status: "watching",
    seasons: [{ eps: 13, watched: 3 }], addedAt: Date.now(), poster: { from: "#333", to: "#000", emoji: "📺" } });
  localStorage.setItem("butaca:lib:v1", JSON.stringify(lib));
});
await page.reload();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await buscar("soprano");
ok("3. una serie en curso dice «Viendo · T1·E3»", /Viendo.*T1·E3/s.test(await fila("Los Soprano").innerText()));

ok("4. sin errores de JS", errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(fallos ? 1 : 0);
