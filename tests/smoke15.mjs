// Saludo del dashboard en dos líneas y swipe ⬇ «otro día» en Descubrir:
// aparta la carta sin guardar nada y reaparece en la siguiente tanda.
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 21, media_type: "movie", title: "Nova Prime", release_date: "2026-01-10", overview: "x", vote_average: 7, poster_path: "/1.jpg" },
    { id: 22, media_type: "movie", title: "Eco Azul", release_date: "2025-09-05", overview: "x", vote_average: 7, poster_path: "/2.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 110, genres: [{ name: "Drama" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);
const topTitle = () => page.getByRole("dialog").locator("p.text-xl").first().textContent();

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(700);

// 1. saludo en dos líneas controladas
ok("h1 con dos líneas (saludo + pregunta)", (await page.locator("h1 span").count()) === 2);
ok("la pregunta va en su propia línea", (await page.locator("h1 span").nth(1).textContent()) === "¿Qué toca hoy?");
await page.screenshot({ path: "shot15-saludo.png" });

// 2. botón 💤: aparta sin guardar nada
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("1ª carta: Nova Prime", (await topTitle()) === "Nova Prime");
await page.getByRole("button", { name: "Otro día" }).click();
await page.waitForTimeout(700);
ok("toast «otro día será»", (await page.getByText("💤 «Nova Prime» — otro día será").count()) > 0);
ok("pasa a la siguiente carta", (await topTitle()) === "Eco Azul");

// 3. swipe ⬇ real con arrastre
const box = await page.getByRole("dialog").locator("div.touch-none").first().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3 + 60, { steps: 4 });
await page.waitForTimeout(120);
const labelShown = (await page.getByText("OTRO DÍA").count()) > 0;
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3 + 200, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(700);
ok("etiqueta 💤 OTRO DÍA durante el arrastre", labelShown);
ok("swipe ⬇ aparta «Eco Azul»", (await page.getByText("💤 «Eco Azul» — otro día será").count()) > 0);
await page.screenshot({ path: "shot15-vacio.png" });

// 4. no ha quedado guardado en ninguna lista
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
for (const tab of [/^Por ver/, /^Ni con un palo/, /^Vistas/]) {
  await page.getByRole("button", { name: tab }).click();
  await page.waitForTimeout(250);
}
ok("Nova Prime no está en la videoteca", (await page.getByText("Nova Prime").count()) === 0);

// 5. y al reabrir el deck, las apartadas reaparecen
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("Nova Prime reaparece en la siguiente tanda", (await topTitle()) === "Nova Prime");

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
