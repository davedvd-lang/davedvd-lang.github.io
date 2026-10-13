// Cachés con tope.
//
// 1. Las cachés de localStorage (fichas, fechas de episodios, novedades de series)
//    solo crecían: unos 3 MB al año con uso diario, en el mismo hueco (5-10 MB) que
//    la videoteca. Ahora cada escritura tira lo caducado.
// 2. Si aun así localStorage se llena, guardar la videoteca tira las cachés y
//    reintenta: antes fallaba en silencio y lo añadido se perdía al reabrir.
// 3. Web/PWA: el service worker guarda como mucho 400 carátulas (antes, sin tope)
//    y borra la caché antigua «butaca-v1».
import { chromium } from "playwright-core";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const FILE_URL = "file://" + process.cwd() + "/dist/index.html";
const DAY = 864e5;
const poster = { from: "#3b4863", to: "#0b0e16", emoji: "🎬" };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fallos = 0;
const ok = (label, cond) => { if (!cond) fallos++; console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`); };

// ─── 1. la caché de novedades de series tira lo caducado al escribir ───
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/api.themoviedb.org/3/tv/**", (r) =>
    r.fulfill({ json: { number_of_seasons: 1, seasons: [{ season_number: 1, episode_count: 10 }] } }));
  await ctx.route(/(tvmaze|itunes\.apple|image\.tmdb|search|trending|discover)/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(FILE_URL);
  await page.waitForTimeout(400);
  const viejo = Date.now() - 3 * DAY;
  await page.evaluate(({ viejo, poster }) => {
    const lib = [{ id: 1, type: "series", title: "Severance", year: 2022, tmdbId: 95396, status: "watching", seasons: [{ eps: 10, watched: 3 }], addedAt: Date.now(), poster }];
    localStorage.setItem("butaca:lib:v1", JSON.stringify(lib));
    localStorage.setItem("butaca:welcome:v1", "1");
    localStorage.setItem("butaca:tmdb-key", "k");
    // 300 series de hace tiempo (ya no están en la videoteca) + una consultada hoy
    const cache = {};
    for (let i = 0; i < 300; i++) cache[`vieja-${i}`] = { ts: viejo, seasons: Array(40).fill(13) };
    cache["fresca"] = { ts: Date.now(), seasons: [8] };
    localStorage.setItem("butaca:tvcheck:v1", JSON.stringify(cache));
  }, { viejo, poster });
  const antes = await page.evaluate(() => localStorage.getItem("butaca:tvcheck:v1").length);
  await page.reload();
  await page.waitForTimeout(1500);
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem("butaca:tvcheck:v1")));
  const claves = Object.keys(cache || {});
  const despues = JSON.stringify(cache).length;
  ok(`1. caché de novedades podada (${antes} → ${despues} bytes)`, despues < antes / 20);
  ok("   sin rastro de lo caducado", !claves.some((k) => k.startsWith("vieja-")));
  ok("   conserva lo fresco y lo recién consultado", claves.includes("fresca") && claves.length === 2);
  await ctx.close();
}

// ─── 2. localStorage lleno: la videoteca se guarda igual (fuera cachés) ───
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.route("**/api.themoviedb.org/3/search/multi**", (r) =>
    r.fulfill({ json: { results: [
      { id: 603, media_type: "movie", title: "Matrix", release_date: "1999-03-31", overview: "Neo descubre la verdad sobre la realidad.", vote_average: 8.2, poster_path: "/m.jpg" },
    ] } }));
  await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 136, genres: [{ name: "Ciencia ficción" }] } }));
  await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG }));
  await ctx.route(/(tvmaze|itunes\.apple|trending|discover|\/3\/tv\/)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(FILE_URL + "?demo");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Stats" }).click();
  await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
  await page.getByRole("button", { name: /Guardar/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Añadir título" }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder("Busca una peli o serie…").fill("matrix");
  await page.waitForTimeout(900);

  // llena localStorage con caché de fichas hasta no dejar hueco ni para un título más
  const lleno = await page.evaluate(() => {
    const K = "butaca:extras:v1";
    const wrap = (n) => JSON.stringify({ relleno: { ts: Date.now(), data: "x".repeat(n) } });
    let lo = 0, hi = 12e6;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      try { localStorage.setItem(K, wrap(mid)); lo = mid; } catch { hi = mid - 1; }
    }
    localStorage.setItem(K, wrap(lo));
    try { localStorage.setItem("prueba-hueco", "x".repeat(200)); localStorage.removeItem("prueba-hueco"); return false; }
    catch { return true; }
  });
  ok("2. localStorage lleno (no caben ni 200 caracteres más)", lleno);

  await page.getByRole("button", { name: "Añadir Matrix a Por ver" }).click();
  await page.waitForTimeout(800);
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem("butaca:lib:v1")).some((i) => i.title === "Matrix"));
  ok("   «Matrix» se guarda igualmente", guardada);
  ok("   a costa de la caché, que se puede volver a pedir", await page.evaluate(() => localStorage.getItem("butaca:extras:v1") === null));
  await page.goto(FILE_URL); // sin ?demo, que resembraría la videoteca de ejemplo
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Pelis" }).click();
  await page.getByRole("button", { name: /^Por ver/ }).click();
  await page.waitForTimeout(400);
  ok("   y sigue ahí al reabrir la app (Pelis → Por ver)", (await page.getByText("Matrix").count()) > 0);
  ok("   sin errores de JS", errors.length === 0);
  if (errors.length) console.log(errors);
  await ctx.close();
}

// ─── 3. PWA: tope de 400 carátulas y adiós a «butaca-v1» ───
{
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  let swVersion = "";
  const app = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join("dist", p);
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    let body = readFileSync(file);
    if (p === "/sw.js") body = Buffer.concat([body, Buffer.from(swVersion)]); // fuerza una actualización
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  });
  // otro origen (otro puerto) que hace de servidor de carátulas
  const imgs = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "image/png", "access-control-allow-origin": "*" });
    res.end(PNG);
  });
  await new Promise((r) => app.listen(8724, r));
  await new Promise((r) => imgs.listen(8725, r));

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/(tvmaze|itunes\.apple|themoviedb|image\.tmdb)/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto("http://localhost:8724/?demo");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ya controlada por el service worker
  await page.waitForTimeout(500);
  ok("3. página controlada por el service worker", await page.evaluate(() => !!navigator.serviceWorker.controller));

  // un usuario de antes: caché antigua con shell y carátulas mezclados
  await page.evaluate(async () => {
    const c = await caches.open("butaca-v1");
    await c.put("/carátula-vieja.png", new Response("x"));
  });
  swVersion = "\n// v-test";
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
  });
  await page.waitForTimeout(1500);
  const nombres = await page.evaluate(() => caches.keys());
  ok(`   al actualizar, fuera «butaca-v1» (quedan: ${nombres.join(", ")})`, !nombres.includes("butaca-v1") && nombres.includes("butaca-v2"));
  await page.reload();
  await page.waitForTimeout(500);

  // muchas carátulas distintas desde otro origen, en tandas (como al hacer scroll).
  // «cors»: el navegador cuenta su tamaño real; «opaca» (como en la app, sin
  // crossorigin): cuentan como varios MB cada una y la cuota se llena antes.
  const cargar = async (dir, N, cors) => {
    for (let start = 0; start < N; start += 60) {
      await page.evaluate(({ dir, start, n, cors }) => Promise.all(Array.from({ length: n }, (_, j) => new Promise((res) => {
        const img = new Image();
        if (cors) img.crossOrigin = "anonymous";
        img.onload = img.onerror = res;
        img.src = `http://localhost:8725/${dir}/${start + j}.png`;
        document.body.appendChild(img);
      }))), { dir, start, n: Math.min(60, N - start), cors });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    return page.evaluate(async ([dir, N]) => {
      const urls = (await (await caches.open("butaca-img-v1")).keys()).map((r) => r.url);
      const de = urls.filter((u) => u.includes(`/${dir}/`));
      return { n: urls.length, primera: de.some((u) => u.endsWith(`/${dir}/0.png`)), ultima: de.some((u) => u.endsWith(`/${dir}/${N - 1}.png`)) };
    }, [dir, N]);
  };
  const st = await cargar("p", 420, true);
  ok(`   tope de carátulas: ${st.n} guardadas de 420 vistas`, st.n <= 400 && st.n >= 390);
  ok("   se van las más antiguas y se quedan las últimas", !st.primera && st.ultima);
  await page.evaluate(() => caches.delete("butaca-img-v1")); // un usuario real: todas opacas
  const op = await cargar("o", 300, false);
  ok(`   cuota llena (carátulas opacas): sigue guardando las nuevas (${op.n} en caché)`, op.ultima && op.n <= 400);
  const shell = await page.evaluate(async () => (await (await caches.open("butaca-v2")).keys()).length);
  ok(`   el shell va aparte y no cuenta para el tope (${shell} archivos)`, shell >= 3);

  // sigue funcionando offline
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(800);
  ok("   la app sigue abriendo sin conexión", (await page.getByText("Sigues viendo").count()) > 0);
  await ctx.close();
  app.close();
  imgs.close();
}

await browser.close();
console.log(fallos ? `\n${fallos} fallo(s)` : "\ntodo en verde");
process.exit(fallos ? 1 : 0);
