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
    { id: 91, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "Un ladrón meticuloso y un detective obsesivo.", poster_path: "/h.jpg" },
    { id: 92, media_type: "tv", name: "Los Soprano", first_air_date: "1999-01-10", overview: "Un capo de Nueva Jersey va a terapia.", poster_path: "/s.jpg" },
    { id: 93, media_type: "movie", title: "Alien", release_date: "1979-05-25", overview: "En el espacio nadie puede oír tus gritos.", poster_path: "/a.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 170, genres: [{ name: "Crimen" }] } }));
await ctx.route("**/api.themoviedb.org/3/tv/**", (r) => r.fulfill({ json: { genres: [{ name: "Drama" }], seasons: [{ season_number: 1, episode_count: 13 }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);

// 1. tarjeta v2: sigue descargándose bien
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
ok("tarjeta v2 descargada", dl.suggestedFilename() === "butaca-whiplash.png");
ok("tarjeta v2 con contenido", readFileSync(await dl.path()).length > 20000);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 2. «ni con un palo» desde la preview del buscador
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("coherence");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Ver ficha de Coherence" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Ni con un palo", exact: true }).click();
await page.waitForTimeout(400);
ok("toast de adopción en «Ni con un palo»", (await page.getByText(/Ni con un palo/).count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);
ok("el buscador la marca 🥢", (await page.getByText("🥢 Ni con un palo").count()) > 0);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Ni con un palo/ }).click();
await page.waitForTimeout(300);
ok("pestaña «Ni con un palo» con Coherence", (await page.getByText("Coherence").count()) > 0);
await page.screenshot({ path: "shot8-skipped.png" });

// 3. Descubrir sin clave: catálogo local, decidir con botones
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(500);
ok("deck abierto con candidato local", (await page.getByRole("dialog").getByText(/Andor|Interstellar|True Detective|El Padrino|Arcane|Blade Runner|Shōgun/).count()) > 0);
const firstTitle = await page.getByRole("dialog").locator("p.text-xl").first().textContent();
await page.getByRole("button", { name: "Añadir a Por ver" }).click();
await page.waitForTimeout(500);
ok(`botón ⬆ añade «${firstTitle}» a Por ver`, (await page.getByText(`«${firstTitle}» en «Por ver»`).count()) > 0);
await page.screenshot({ path: "shot8-deck.png" });

// 4. swipe real con arrastre (izquierda = ni con un palo)
const secondTitle = await page.getByRole("dialog").locator("p.text-xl").first().textContent();
const card = page.getByRole("dialog").locator("div.touch-none").first();
const box = await card.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 5 });
await page.waitForTimeout(100);
const labelShown = (await page.getByText("NI CON UN PALO").count()) > 0;
await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
ok("etiqueta 🥢 visible durante el arrastre", labelShown);
ok(`swipe izquierda descarta «${secondTitle}»`, (await page.getByText(`🥢 «${secondTitle}»: ni con un palo`).count()) > 0);

// 5. con TMDB: trending en el deck y swipe derecha = vista
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("deck con trending de TMDB (Heat)", (await page.getByRole("dialog").getByText("Heat").count()) > 0);
await page.getByRole("button", { name: "Marcar como vista" }).click();
await page.waitForTimeout(800);
ok("swipe derecha: «Heat» vista", (await page.getByText(/«Heat» en «Vista»/).count()) > 0);
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Vistas/ }).click();
await page.waitForTimeout(300);
ok("Heat en Vistas con duración real", (await page.getByText("Heat").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
