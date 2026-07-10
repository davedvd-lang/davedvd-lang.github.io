// Descubrir v3: mezcla de épocas (trending intercalado con joyas de otras
// décadas vía discover) y cierre diario de la sala (tope de decisiones/día).
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) =>
  r.fulfill({ json: { results: [
    { id: 11, media_type: "movie", title: "Nova Prime", release_date: "2026-03-01", overview: "Estreno de 2026.", vote_average: 7.2, poster_path: "/n.jpg" },
    { id: 12, media_type: "movie", title: "Eco Azul", release_date: "2025-11-07", overview: "Estreno reciente.", vote_average: 6.9, poster_path: "/e.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) =>
  r.fulfill({ json: { results: [
    { id: 105, title: "Regreso al futuro", release_date: "1985-07-03", overview: "Marty McFly viaja a 1955.", vote_average: 8.3, poster_path: "/r.jpg" },
    { id: 578, title: "Tiburón", release_date: "1975-06-20", overview: "Un gran blanco aterroriza Amity.", vote_average: 7.6, poster_path: "/t.jpg" },
  ] } })
);
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 116, genres: [{ name: "Aventura" }] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

// hoy ya se han gastado 27 decisiones de 30: quedan 3 para probar el cierre
// (solo en el primer arranque — el init script corre también al recargar)
const seedQuota = () => {
  if (localStorage.getItem("butaca:deckquota:v1")) return;
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  localStorage.setItem("butaca:deckquota:v1", JSON.stringify({ day, count: 27 }));
};
await ctx.addInitScript(seedQuota);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);
const topTitle = () => page.getByRole("dialog").locator("p.text-xl").first().textContent();

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Hoy" }).click();
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);

// 1. aviso de turnos restantes y mezcla de épocas: actual → clásica → actual
ok("aviso «quedan 3 hoy»", (await page.getByText("quedan 3 hoy").count()) > 0);
ok("1ª carta: estreno del trending (Nova Prime)", (await topTitle()) === "Nova Prime");
await page.getByRole("button", { name: "Añadir a Por ver" }).click();
await page.waitForTimeout(700);
ok("2ª carta: joya de otra década (Regreso al futuro, 1985)", (await topTitle()) === "Regreso al futuro");
ok("con su año de época", (await page.getByRole("dialog").getByText(/· 1985/).count()) > 0);
await page.screenshot({ path: "shot11-clasico.png" });
await page.getByRole("button", { name: "Marcar como vista" }).click();
await page.waitForTimeout(700);
ok("3ª carta: de nuevo del trending (Eco Azul)", (await topTitle()) === "Eco Azul");
ok("aviso «queda 1 hoy»", (await page.getByText("queda 1 hoy").count()) > 0);

// 2. última decisión del día ⇒ la sala cierra
await page.getByRole("button", { name: "Ni con un palo" }).click();
await page.waitForTimeout(700);
ok("pantalla «La sala cierra por hoy»", (await page.getByText("La sala cierra por hoy").count()) > 0);
ok("botones de decisión ocultos", (await page.getByRole("button", { name: "Marcar como vista" }).count()) === 0);
ok("las cartas restantes no se muestran", (await page.getByRole("dialog").getByText("Tiburón").count()) === 0);
await page.screenshot({ path: "shot11-cierre.png" });

// 3. el cierre persiste: reabrir el deck y recargar la app
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.waitForTimeout(300);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("sigue cerrada al reabrir el deck", (await page.getByText("La sala cierra por hoy").count()) > 0);
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.reload();
await page.waitForTimeout(700);
await page.getByText("🔥 Descubrir").click();
await page.waitForTimeout(900);
ok("sigue cerrada tras recargar la app", (await page.getByText("La sala cierra por hoy").count()) > 0);

// 4. lo decidido antes del cierre quedó bien guardado
await page.getByRole("button", { name: "Cerrar Descubrir" }).click();
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Por ver/ }).click();
await page.waitForTimeout(300);
ok("Nova Prime en Por ver", (await page.getByText("Nova Prime").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
