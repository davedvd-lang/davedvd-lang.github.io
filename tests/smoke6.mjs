import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(/(tvmaze|itunes|themoviedb|image\.tmdb)/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FALLO"} ${label}`);

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(600);

// título de stats
await page.getByRole("button", { name: "Stats" }).click();
await page.waitForTimeout(300);
ok("«Tu tiempo en pantalla»", (await page.getByText("Tu tiempo en pantalla").count()) > 0);

// bloque TMDB: expandido sin clave → plegado al guardar → editable
ok("sin clave: bloque expandido", (await page.getByPlaceholder("Pega aquí tu API key…").count()) > 0);
await page.getByPlaceholder("Pega aquí tu API key…").fill("clave-test");
await page.getByRole("button", { name: /Guardar/ }).click();
await page.waitForTimeout(400);
ok("al guardar: plegado con «✓ TMDB conectado»", (await page.getByText("✓ TMDB conectado").count()) > 0);
ok("al guardar: input oculto", (await page.getByPlaceholder("Pega aquí tu API key…").count()) === 0);
await page.screenshot({ path: "shot6-collapsed.png" });
await page.getByRole("button", { name: "Editar" }).click();
await page.waitForTimeout(300);
ok("Editar: input con la clave actual", (await page.getByPlaceholder("Pega aquí tu API key…").inputValue()) === "clave-test");
ok("Editar: opción desconectar visible", (await page.getByText("Desconectar TMDB").count()) > 0);
await page.getByText("Desconectar TMDB").click();
await page.waitForTimeout(300);
ok("desconectada: bloque expandido de nuevo", (await page.getByPlaceholder("Pega aquí tu API key…").count()) > 0);

// ordenación por estreno (pelis Por ver: Dune 2024 > La La Land 2016 > Oldboy 2003)
await page.getByRole("button", { name: "Pelis" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Por ver/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Estreno" }).click();
await page.waitForTimeout(300);
const t = await page.locator(".grid p.truncate.text-xs").allTextContents();
ok(`orden por estreno: ${t.join(", ")}`, t[0] === "Dune: Parte Dos" && t[t.length-1] === "Oldboy");
await page.screenshot({ path: "shot6-release-sort.png" });

console.log("errores:", errors.length ? errors : "ninguno");
await browser.close();
