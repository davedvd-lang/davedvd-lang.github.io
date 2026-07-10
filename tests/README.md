# Tests de humo (Playwright)

Se ejecutan contra el build local (`dist/index.html`), con las APIs externas
simuladas mediante `page.route` donde hace falta — no necesitan red ni claves.

```bash
npm run build
node tests/smoke8.mjs   # el más reciente; cada smokeN cubre una tanda de features
```

Requieren `playwright-core` (`npm i -D playwright-core`) y un Chromium local:
ajusta `executablePath` al principio de cada script si tu Chromium no está en
`/opt/pw-browsers/chromium` (ruta del entorno donde se escribieron).

| Script | Cubre |
|---|---|
| smoke.mjs | flujo básico: dashboard, +1 capítulo, ficha, buscador, biblioteca |
| smoke2.mjs | carátulas (TVmaze/iTunes/TMDB simulados), sinopsis, persistencia, alta TMDB |
| smoke3.mjs | PWA por HTTP: service worker, offline, exportar/importar JSON |
| smoke4.mjs | estados En pausa/Abandonada, revisionados, ordenación |
| smoke5.mjs | preview de resultados del buscador y adopción con la primera acción |
| smoke6.mjs | «Tu tiempo en pantalla», bloque TMDB plegable, orden por estreno |
| smoke7.mjs | actividad/racha, ruleta, notas, tarjeta v1, género, aviso de temporada |
| smoke8.mjs | tarjeta v2, «Ni con un palo», deck Descubrir (botones y arrastre real) |
