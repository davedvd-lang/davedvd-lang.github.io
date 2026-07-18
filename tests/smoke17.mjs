// Estreno en blanco: bienvenida con gracias en el primer arranque, videoteca
// vacía para usuarios nuevos (sin datos de ejemplo), «Borrar toda la videoteca»
// con confirmación, y el modo ?demo sigue sembrando para tests/demos.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.route("**/image.tmdb.org/**", (r) => r.abort());
await ctx.route(/(tvmaze|itunes\.apple|themoviedb)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

// 1. primer arranque de verdad (sin ?demo): bienvenida con gracias
await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);
ok("bienvenida con gracias", (await page.getByText(/Gracias por hacerle/).count()) > 0);
ok("con la promesa de privacidad", (await page.getByText(/solo en tu dispositivo/).count()) > 0);
await page.screenshot({ path: "shot17-bienvenida.png" });
await page.getByRole("button", { name: /Entrar a la sala/ }).click();
await page.waitForTimeout(400);

// 2. videoteca vacía: nada de datos de ejemplo, y guía de primeros pasos
ok("dashboard con «Tu butaca está lista»", (await page.getByText("Tu butaca está lista").count()) > 0);
ok("cero en curso", (await page.getByText("0 en curso").count()) > 0);
ok("sin Severance ni datos de ejemplo", (await page.getByText("Severance").count()) === 0);
await page.screenshot({ path: "shot17-vacia.png" });
await page.getByRole("button", { name: "Series" }).click();
await page.waitForTimeout(300);
ok("Series vacía", (await page.getByText("The Bear").count()) === 0);

// 3. la bienvenida no vuelve a salir tras recargar
await page.reload();
await page.waitForTimeout(700);
ok("sin bienvenida en la segunda apertura", (await page.getByText(/Gracias por hacerle/).count()) === 0);

// 4. añadir el primer título desde el catálogo local (sin clave)
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("coherence");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Añadir Coherence a Por ver" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(300);
ok("primer título en «Para esta noche»", (await page.getByText("Coherence").count()) > 0);
ok("la guía de primeros pasos ya no está", (await page.getByText("Tu butaca está lista").count()) === 0);

// 5. borrar toda la videoteca (con confirmación) ⇒ vacía otra vez, sin seeds
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Borrar toda la videoteca/ }).click();
await page.waitForTimeout(500);
ok("toast de videoteca vacía", (await page.getByText(/empezamos de cero/).count()) > 0);
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(300);
ok("vacía de verdad (sin datos de ejemplo)", (await page.getByText("Tu butaca está lista").count()) > 0 && (await page.getByText("Coherence").count()) === 0);

// 6. el modo ?demo sigue sembrando (para tests y demos)
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx2.route("**/image.tmdb.org/**", (r) => r.abort());
await ctx2.route(/(tvmaze|itunes\.apple|themoviedb)/, (r) => r.abort());
const page2 = await ctx2.newPage();
await page2.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page2.waitForTimeout(700);
ok("?demo siembra la videoteca de ejemplo", (await page2.getByText("Severance").count()) > 0);
ok("?demo sin pantalla de bienvenida", (await page2.getByText(/Gracias por hacerle/).count()) === 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
