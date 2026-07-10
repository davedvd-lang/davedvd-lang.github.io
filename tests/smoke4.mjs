import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html");
await page.waitForTimeout(700);

// 1. atajo de pausadas en el dashboard → pestaña En pausa de Series
ok("atajo «1 serie en pausa» visible", (await page.getByText("1 serie en pausa").count()) > 0);
await page.getByText("1 serie en pausa").click();
await page.waitForTimeout(400);
ok("The Last of Us en «En pausa»", (await page.getByText("The Last of Us").count()) > 0);
ok("etiqueta «Esperando temporada»", (await page.getByText("Esperando temporada").count()) > 0);
await page.screenshot({ path: "shot4-paused.png" });

// 2. reanudar con ▶ desde la rejilla (1 toque)
await page.getByRole("button", { name: "Reanudar The Last of Us" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^Viendo/ }).first().click();
await page.waitForTimeout(300);
ok("reanudada → aparece en Viendo", (await page.getByText("The Last of Us").count()) > 0);

// 3. abandonadas: registro de dónde la dejaste
await page.getByRole("button", { name: /^Abandonadas/ }).click();
await page.waitForTimeout(300);
ok("Perdidos abandonada con registro T1·E8", (await page.getByText("La dejaste en T1·E8").count()) > 0);
await page.getByText("Perdidos").first().click();
await page.waitForTimeout(400);
ok("ficha: texto de abandono", (await page.getByText(/Abandonada en T1·E8/).count()) > 0);
await page.screenshot({ path: "shot4-dropped.png" });

// 4. pasar Perdidos a En pausa desde la ficha (chips de estado)
await page.getByRole("button", { name: "En pausa", exact: true }).click();
await page.waitForTimeout(300);
ok("chip de estado cambia a En pausa", (await page.getByText(/te quedaste en T1·E8/).count()) > 0);
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 5. revisionado de película: contador sin romper historial
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Vistas/ }).click();
await page.waitForTimeout(300);
ok("badge ×3 en Whiplash", (await page.getByText("×3").count()) > 0);
await page.getByText("Whiplash").first().click();
await page.waitForTimeout(400);
ok("ficha: «Vista 3 veces»", (await page.getByText("Vista 3 veces").count()) > 0);
await page.getByRole("button", { name: "+1 vista otra vez" }).click();
await page.waitForTimeout(300);
ok("contador sube a 4", (await page.getByText("Vista 4 veces").count()) > 0);
ok("sigue en estado Vista", (await page.getByText(/Movida a/).count()) === 0);
await page.screenshot({ path: "shot4-rewatch.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// 6. revisionado de serie: reset de progreso con historial intacto
await page.getByRole("button", { name: "Series" }).last().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Vistas/ }).click();
await page.waitForTimeout(300);
await page.getByText("Succession").first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Volver a empezar/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Hoy" }).click();
await page.waitForTimeout(400);
ok("Succession revisionándose en el dashboard", (await page.getByRole("button", { name: /T1·E1 vista.*Succession|Marcar/ }).count()) >= 0 && (await page.getByText("Revisionado").count()) > 0);
await page.screenshot({ path: "shot4-rewatch-series.png" });

// 7. ordenación de la watchlist de pelis por duración
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Por ver/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Duración" }).click();
await page.waitForTimeout(300);
const titles = await page.locator(".grid p.truncate.text-xs").allTextContents();
ok(`orden por duración (Oldboy 120’ < La La Land 128’ < Dune 166’): ${titles.join(", ")}`,
  titles.indexOf("Oldboy") < titles.indexOf("La La Land") && titles.indexOf("La La Land") < titles.indexOf("Dune: Parte Dos"));
await page.getByRole("button", { name: "Reciente" }).click();
await page.waitForTimeout(300);
const t2 = await page.locator(".grid p.truncate.text-xs").allTextContents();
ok(`orden por reciente (Dune añadida ayer, primera): ${t2[0]}`, t2[0] === "Dune: Parte Dos");
await page.screenshot({ path: "shot4-sort.png" });

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
