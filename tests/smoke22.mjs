// Copia de seguridad automática (Android) + contador del deck.
//
// Motivo: a la pareja del usuario le robaron el móvil y perdió toda su videoteca.
// Android ya tenía la copia automática activada, pero copiaba también la caché de
// carátulas del WebView, pasaba de 25 MB y fallaba entera. Ahora la app deja un
// espejo pequeño (`butaca-backup.json`) y Android copia SOLO ese archivo.
//
// En el navegador, @capacitor/filesystem guarda en IndexedDB («Disc» → «FileStorage»),
// así que activando window.__BUTACA_BACKUP_TEST__ se ejercita la MISMA lógica que en
// Android, inspeccionando el espejo directamente en IndexedDB.
import { chromium } from "playwright-core";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const MIRROR = "/DATA/butaca-backup.json";
const URL = "file://" + process.cwd() + "/dist/index.html";
const poster = { from: "#3b4863", to: "#0b0e16", emoji: "🎬" };
const seedLib = [
  { id: 1, type: "movie", title: "El Padrino", year: 1972, genre: "Drama", status: "watched", rating: 5, watchedAt: Date.now(), addedAt: Date.now(), poster },
  { id: 2, type: "series", title: "Los Soprano", year: 1999, genre: "Drama", status: "watching", seasons: [{ eps: 13, watched: 4 }], addedAt: Date.now(), poster },
  { id: 3, type: "movie", title: "Heat", year: 1995, genre: "Crimen", status: "watchlist", addedAt: Date.now(), poster },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fallos = 0;
const ok = (label, cond) => { if (!cond) fallos++; console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`); };

// IndexedDB del plugin (solo tras un arranque: es el plugin quien crea la base)
const readMirror = (page) => page.evaluate((path) => new Promise((resolve) => {
  const req = indexedDB.open("Disc");
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("FileStorage")) return resolve(null);
    const get = db.transaction(["FileStorage"], "readonly").objectStore("FileStorage").get(path);
    get.onsuccess = () => resolve(get.result ? get.result.content : null);
    get.onerror = () => resolve(null);
  };
}), MIRROR);
const writeMirror = (page, content) => page.evaluate(([path, content]) => new Promise((resolve) => {
  const req = indexedDB.open("Disc");
  req.onsuccess = () => {
    const tx = req.result.transaction(["FileStorage"], "readwrite");
    tx.objectStore("FileStorage").put({ path, folder: "/DATA", type: "file", size: content.length, ctime: Date.now(), mtime: Date.now(), content });
    tx.oncomplete = () => resolve(true);
  };
}), [MIRROR, content]);

async function backupCtx() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(() => { window.__BUTACA_BACKUP_TEST__ = true; });
  await ctx.route(/(tvmaze|itunes\.apple|themoviedb|image\.tmdb)/, (r) => r.abort());
  return ctx;
}

// ─── 1-3. espejo → móvil nuevo → restauración → vaciado deliberado ───
{
  const ctx = await backupCtx();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());

  await page.goto(URL);
  await page.waitForTimeout(500);
  await page.evaluate((lib) => {
    localStorage.setItem("butaca:lib:v1", JSON.stringify(lib));
    localStorage.setItem("butaca:welcome:v1", "1");
  }, seedLib);
  await page.reload();
  await page.waitForTimeout(2200); // más que la agrupación de 1,2 s

  const snap = JSON.parse((await readMirror(page)) || "null");
  ok("1. el espejo se escribe solo al usar la app", !!snap);
  ok("   con la videoteca completa (3 títulos)", snap?.library?.length === 3);
  ok("   y en formato de exportación (sirve también para Importar)", snap?.app === "butaca" && snap?.version === 1);

  // móvil nuevo: la app se instala (localStorage vacío) y Android devuelve el espejo
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  ok("2. móvil nuevo: vuelve «El Padrino»", (await page.getByText("El Padrino").count()) > 0);
  ok("   y «Los Soprano», y «Heat»", (await page.getByText("Los Soprano").count()) > 0 && (await page.getByText("Heat").count()) > 0);
  ok("   aviso «Recuperada tu videoteca… 3 títulos»", (await page.getByText(/Recuperada tu videoteca.*3 títulos/).count()) > 0);
  ok("   sin pantalla de bienvenida (ya conoce la app)", (await page.getByText(/Gracias por hacerle/).count()) === 0);
  const serie = await page.evaluate(() => JSON.parse(localStorage.getItem("butaca:lib:v1")).find((i) => i.title === "Los Soprano"));
  ok("   con el progreso intacto (T1: 4 de 13)", serie?.seasons?.[0]?.watched === 4);

  // vaciar a propósito también vacía el espejo: nada resucita
  await page.getByRole("button", { name: "Stats" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Borrar toda la videoteca/ }).click();
  await page.waitForTimeout(800);
  const vacio = JSON.parse((await readMirror(page)) || "null");
  ok("3. borrar la videoteca vacía también el espejo, al instante", vacio?.library?.length === 0);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  ok("   tras reinstalar, lo borrado NO resucita", (await page.getByText("El Padrino").count()) === 0);
  ok("   sin errores de JS", errors.length === 0);
  if (errors.length) console.log(errors);
  await ctx.close();
}

// ─── 4. arrancar vacío JAMÁS machaca una copia existente ───
// (el caso peligroso: móvil nuevo cuya restauración falla o tarda; la app arranca
// vacía y, sin blindaje, escribiría un espejo vacío encima de la copia buena)
{
  const ctx = await backupCtx();
  const page = await ctx.newPage();
  await page.goto(URL); // primer arranque: el plugin crea su base (aún sin espejo)
  await page.waitForTimeout(800);
  const ajeno = JSON.stringify({ app: "no-restaurable", library: [{ title: "X" }] });
  await writeMirror(page, ajeno);
  await page.reload(); // localStorage vacío + espejo que no se puede restaurar
  await page.waitForTimeout(2200);
  ok("4. un arranque vacío deja la copia existente intacta", (await readMirror(page)) === ajeno);
  await ctx.close();
}

// ─── 5. fuera de la app nativa, ni rastro de la copia ───
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/(tvmaze|itunes\.apple|themoviedb|image\.tmdb)/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(URL + "?demo");
  await page.waitForTimeout(2200);
  const hayBase = await page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === "Disc"));
  ok("5. en la web no se escribe ningún espejo", !hayBase);
  await page.getByRole("button", { name: "Stats" }).click();
  await page.waitForTimeout(300);
  ok("   ni aparece la nota de copia automática", (await page.getByText(/Copia automática/).count()) === 0);
  await ctx.close();
}

// ─── 6. el contador «quedan N» se ve junto al título aunque esté «Deshacer» ───
for (const W of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, hasTouch: true });
  const cards = Array.from({ length: 12 }, (_, i) => ({ id: 500 + i, media_type: "movie", title: `Peli ${i + 1}`, release_date: "2025-01-01", overview: "x", vote_average: 7, poster_path: "/p.jpg" }));
  await ctx.route("**/api.themoviedb.org/3/trending/all/week**", (r) => r.fulfill({ json: { results: cards } }));
  await ctx.route("**/api.themoviedb.org/3/discover/movie**", (r) => r.fulfill({ json: { results: [] } }));
  await ctx.route("**/api.themoviedb.org/3/movie/**", (r) => r.fulfill({ json: { runtime: 100, genres: [] } }));
  await ctx.route("**/image.tmdb.org/**", (r) => r.fulfill({ contentType: "image/png", body: PNG }));
  await ctx.route(/(tvmaze|itunes\.apple)/, (r) => r.abort());
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("butaca:deckquota:v1"))
      localStorage.setItem("butaca:deckquota:v1", JSON.stringify({ start: Date.now(), count: 25 }));
  });
  const page = await ctx.newPage();
  await page.goto(URL + "?demo");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Stats" }).click();
  await page.getByPlaceholder("Pega aquí tu API key…").fill("k");
  await page.getByRole("button", { name: /Guardar/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Hoy" }).click();
  await page.getByText("🔥 Descubrir").click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Ni con un palo" }).click();
  await page.waitForTimeout(900);
  const pill = page.getByText(/^quedan \d+$/);
  const box = await pill.boundingBox();
  ok(`6. ${W}px: «Deshacer» y el contador conviven`, await page.getByRole("button", { name: /Deshacer/ }).isVisible() && (await pill.isVisible()));
  ok(`   ${W}px: «${await pill.textContent()}» arriba, junto al título (y=${Math.round(box?.y)})`, box && box.y < 90);
  await ctx.close();
}

await browser.close();
console.log(fallos ? `\n${fallos} fallo(s)` : "\ntodo en verde");
process.exit(fallos ? 1 : 0);
