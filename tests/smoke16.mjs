// Tanda «ficha completa»: tráiler + reparto/dirección en la ficha, nota al
// terminar (toast con estrellas) y saludo de madrugada («Sesión golfa»).
import { chromium } from "playwright-core";

const PNG_POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
  r.fulfill({ json: { results: [
    { id: 500, media_type: "movie", title: "Coherence Online", release_date: "2013-09-19", overview: "Una cena y un cometa.", vote_average: 7.0, poster_path: "/c.jpg" },
  ] } })
);
// una sola respuesta sirve para hidratar (runtime/géneros) y para los extras
// (créditos, vídeos y plataformas vía append_to_response)
await ctx.route("**/api.themoviedb.org/3/movie/**", (r) =>
  r.fulfill({ json: {
    runtime: 89, genres: [{ name: "Sci-Fi" }],
    credits: {
      cast: [{ name: "Emily Baldoni" }, { name: "Maury Sterling" }, { name: "Nicholas Brendon" }],
      crew: [{ job: "Director", name: "James Ward Byrkit" }],
    },
    videos: { results: [
      { site: "YouTube", type: "Trailer", iso_639_1: "en", key: "trailerEN" },
      { site: "YouTube", type: "Trailer", iso_639_1: "es", key: "trailerES" },
    ] },
    "watch/providers": { results: { ES: { flatrate: [{ provider_name: "Filmin" }] } } },
  } })
);
await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => r.fulfill({ json: { results: [] } }));
await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG_POSTER }));
await ctx.route("**youtube-nocookie.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>player</body></html>" }));
await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

// 1. saludo de madrugada: a la 1 AM nada de «buenos días»
await page.clock.setFixedTime(new Date("2026-07-17T01:00:00"));
await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(700);
ok("saludo «Sesión golfa» a la 1 AM", (await page.getByText("Sesión golfa 🍿").count()) > 0);
await page.screenshot({ path: "shot16-golfa.png" });

// 2. ficha con dirección, reparto, streaming y tráiler (preferencia: español)
await page.getByRole("button", { name: "Stats" }).click();
await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Busca una peli o serie…").fill("coherence online");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Ver ficha de Coherence Online" }).click();
await page.waitForTimeout(800);
ok("dirección en la ficha", (await page.getByText("James Ward Byrkit").count()) > 0);
ok("reparto en la ficha", (await page.getByText(/Emily Baldoni, Maury Sterling/).count()) > 0);
ok("streaming embebido (Filmin)", (await page.getByText("Filmin").count()) > 0);
ok("botón de tráiler", (await page.getByRole("button", { name: /Ver tráiler/ }).count()) > 0);
await page.screenshot({ path: "shot16-ficha.png" });

// visor embebido dentro de la app (sin salir a YouTube)
await page.getByRole("button", { name: /Ver tráiler/ }).click();
await page.waitForTimeout(500);
const iframe = page.locator("iframe[title='Tráiler de Coherence Online']");
ok("visor de tráiler abierto en la app", (await iframe.count()) > 0);
ok("tráiler en español preferido, en modo nocookie", ((await iframe.getAttribute("src")) || "").startsWith("https://www.youtube-nocookie.com/embed/trailerES"));
ok("con escape a YouTube por si bloquea el embebido", (await page.getByRole("link", { name: /Abrir en YouTube/ }).count()) > 0);
await page.screenshot({ path: "shot16-visor.png" });
await page.getByRole("button", { name: "✕ Cerrar" }).click();
await page.waitForTimeout(300);
ok("el visor se cierra y la ficha sigue", (await iframe.count()) === 0 && (await page.getByText("James Ward Byrkit").count()) > 0);

// 3. adoptarla como vista abre su ficha con las estrellas a mano
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(700);
ok("ficha adoptada con «Tu nota» a la vista", (await page.getByText("Tu nota").count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Cerrar buscador" }).click();
await page.waitForTimeout(300);

// 4. nota al terminar: marcar «Vista» un título guardado saca el toast con estrellas
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Por ver/ }).click();
await page.waitForTimeout(300);
await page.getByText("Oldboy").first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Vista", exact: true }).click();
await page.waitForTimeout(500);
ok("toast «vista» con estrellas", (await page.locator(".animate-toast").getByRole("button", { name: "4 estrellas" }).count()) > 0);
await page.screenshot({ path: "shot16-toast.png" });
await page.locator(".animate-toast").getByRole("button", { name: "4 estrellas" }).click();
await page.waitForTimeout(400);
ok("nota apuntada desde el toast", (await page.getByText("★★★★ ¡Apuntada!").count()) > 0);
ok("la ficha refleja la nota", (await page.getByText("Tu nota").count()) > 0);

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
