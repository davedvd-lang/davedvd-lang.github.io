import { chromium } from "playwright-core";
import http from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

// mini servidor estático sobre dist/
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".css": "text/css" };
const server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join("dist", p);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8712, r));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:8712/?demo");
await page.waitForTimeout(1200);

// service worker + manifest
const swActive = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
const manifestOk = await page.evaluate(async () => (await fetch("manifest.webmanifest")).ok);
console.log("service worker activo:", swActive, "| manifest:", manifestOk);

// offline: recargar sin red debe servir desde caché
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(800);
const offlineOk = (await page.getByText("Sigues viendo").count()) > 0;
console.log("app funciona offline:", offlineOk);
await ctx.setOffline(false);

// exportar
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /Exportar/ }).click(),
]);
const dlPath = await download.path();
const exported = JSON.parse(readFileSync(dlPath, "utf8"));
console.log("export:", download.suggestedFilename(), "| títulos:", exported.library.length);

// importar (biblioteca mínima de 2 títulos)
const backup = { app: "butaca", version: 1, library: [
  { type: "series", title: "Los Soprano", year: 1999, status: "watching", seasons: [{ eps: 13, watched: 4 }] },
  { type: "movie", title: "Heat", year: 1995, status: "watched", rating: 5, runtime: 170 },
] };
writeFileSync("import-test.json", JSON.stringify(backup));
await page.locator('input[type="file"]').setInputFiles("import-test.json");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(400);
const sopranos = (await page.getByText("Los Soprano").count()) > 0;
console.log("import aplicado (Los Soprano en Hoy):", sopranos);
const nextEp = (await page.getByRole("button", { name: /T1·E5 vista/ }).count()) > 0;
console.log("progreso importado correcto (siguiente T1·E5):", nextEp);
await page.screenshot({ path: "shot3-imported.png" });

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
server.close();
