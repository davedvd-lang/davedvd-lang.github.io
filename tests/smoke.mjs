import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("file://" + process.cwd() + "/dist/index.html?demo");
await page.waitForTimeout(600);
await page.screenshot({ path: "shot-home.png" });

// 1-tap: marcar siguiente episodio de Severance (T2·E7)
await page.getByRole("button", { name: /T2·E7 vista/ }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: "shot-episode-marked.png" });

// abrir ficha de una serie y marcar último episodio visto en la rejilla
await page.getByText("Severance").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "shot-detail.png" });
await page.getByRole("button", { name: "Cerrar ficha" }).click();
await page.waitForTimeout(300);

// añadir desde el buscador
await page.getByRole("button", { name: "Añadir título" }).click();
await page.waitForTimeout(400);
await page.getByPlaceholder("Busca una peli o serie…").fill("andor");
await page.waitForTimeout(300);
await page.screenshot({ path: "shot-add.png" });
await page.getByRole("button", { name: /Añadir Andor a Por ver/ }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Cerrar buscador" }).click();

// biblioteca de series
await page.getByRole("button", { name: "Series" }).last().click();
await page.waitForTimeout(400);
await page.screenshot({ path: "shot-series.png" });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
