// Compila el prototipo a un único HTML autocontenido (sin CDNs ni red).
// Uso: node build.mjs
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const js = (
  await build({
    entryPoints: ["src/main.jsx"],
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  })
).outputFiles[0].text;

mkdirSync("dist", { recursive: true });

execSync("npx @tailwindcss/cli -i src/input.css -o dist/out.css --minify", { stdio: "inherit" });
const css = readFileSync("dist/out.css", "utf8");

const meta = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0e16">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<title>Butaca — tu diario de series y pelis</title>`;

const bodyContent = `<style>${css}</style>
<div id="root"></div>
<script>${js}</script>`;

// El service worker solo aplica servida por http(s) — instalable como PWA y usable offline
const swRegister = `<script>
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
</script>`;

writeFileSync(
  "dist/index.html",
  `<!DOCTYPE html>\n<html lang="es">\n<head>\n${meta}\n</head>\n<body>\n${bodyContent}\n${swRegister}\n</body>\n</html>\n`
);

// Variante para publicar como Artifact (el visor añade su propio esqueleto html/head/body y no permite red)
writeFileSync("dist/artifact.html", `<title>Butaca — tu diario de series y pelis</title>\n${bodyContent}\n`);

// Copia servible directamente (p. ej. GitHub Pages en /butaca/) + activos PWA
writeFileSync("index.html", readFileSync("dist/index.html"));
for (const f of ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
  copyFileSync(`pwa/${f}`, f);
  copyFileSync(`pwa/${f}`, `dist/${f}`);
}

// Copia para la app Android (Capacitor): www/ es su webDir
mkdirSync("www", { recursive: true });
writeFileSync("www/index.html", readFileSync("dist/index.html"));

console.log("OK → index.html, www/ y activos PWA (dist/ para previsualización)");
