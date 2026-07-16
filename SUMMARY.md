# SUMMARY — Estado del proyecto Butaca

> Documento de traspaso entre sesiones. Última actualización: 2026-07-10.
> Para retomar el trabajo con Claude Code: abre una sesión sobre este repo
> (`davedvd-lang/davedvd-lang.github.io`) y lee este archivo + `DESIGN.md` + `ANDROID.md`.

## Qué es esto

**Butaca**: diario personal de series y películas (sustituto de un rastreador que cierra).
React 19 + Tailwind CSS 4 + lucide-react, compilado a un único `index.html` autocontenido.
Sin cuentas ni servidores: todo en `localStorage`, con APIs públicas opcionales.

- **En producción**: https://davedvd-lang.github.io/ (GitHub Pages, se redespliega solo con cada push a `main`)
- **Prototipo en Claude**: https://claude.ai/code/artifact/8d2ddcc9-566a-4793-9369-1026fb2ccf6c (mismo build; su sandbox bloquea red, así que ahí no hay carátulas ni TMDB)
- El repo `davedvd-lang/tally` es OTRA app (finanzas) — no mezclar. Queda allí una rama
  `claude/media-tracker-app-design-9m1p6o` con una copia antigua de Butaca, borrable.

## Estado actual: TODO FUNCIONA y está desplegado

> 2026-07-10 — corregido el cuelgue de Descubrir reportado por el usuario: descartar
> con ⬅ una **serie** del trending la guardaba sin `seasons` y el render del dashboard
> reventaba (app congelada). Ahora todas las decisiones del deck pasan por
> `addFromCatalog` (hidrata temporadas), los helpers toleran series sin `seasons`, y
> `main.jsx` tiene un ErrorBoundary con «Reintentar» como red de seguridad.
> Regresión cubierta en `tests/smoke9.mjs`.

Verificado con tests de humo de navegador (`tests/smoke*.mjs`, todos en verde, APIs simuladas):

- **Estados** por título: Por ver / Viendo / En pausa (solo series) / Vista / Abandonada / **Ni con un palo** (lista negra reversible, fuera de sugerencias y Descubrir).
- **Series**: progreso por temporada/capítulo; +1 capítulo con 1 toque desde el dashboard; tocar un episodio en la rejilla fija «el último visto»; completar ⇒ pasa sola a Vistas.
- **Dashboard «Hoy»**: saludo, chips (racha 🔥, en curso, pendientes, horas), carrusel «Sigues viendo», atajo de pausadas (con aviso de episodios nuevos), banner **Descubrir**, «Para esta noche» + ruleta **Sorpréndeme**, «Últimas vistas».
- **Buscador [+]**: catálogo local sin clave; con API key de TMDB (pestaña Stats, bloque plegable) búsqueda online global es-ES. Tocar un resultado abre la **ficha en modo preview**: la primera acción (estado, episodio) la guarda con esa acción aplicada.
- **Ficha**: sinopsis, chips de estado, rejilla de episodios, nota ★, revisionados (contador pelis / «volver a empezar» series con 🔁), **nota privada**, **compartir tarjeta** (canvas 1080×1350, póster vertical 2:3; Web Share en móvil, PNG en escritorio; también **a medias** «▶ Voy por T2·E6» o **por ver** «✨ ¡Qué buena pinta!» en vez de estrellas, con la nota de la crítica en el pie), **«En streaming»** con las plataformas en España (JustWatch vía TMDB, caché 7 días, atribución incluida), aviso «episodios nuevos» con fusión de temporadas.
- **Descubrir**: deck tipo Tinder (⬅ ni con un palo · ⬆ por ver · ➡ vista · **⬇ otro día**: aparta la carta sin guardar nada y reaparece en la siguiente tanda; gasta turno) con arrastre real + botones; trending semanal TMDB paginado o catálogo local. **Toque en la carta = ficha completa en preview** (sinopsis, duración, géneros; decidir desde ella retira la carta). Nota media de TMDB (★) en carta, ficha y buscador. **Mezcla de épocas**: una del trending, una joya de otra década — 3 décadas distintas por tanda en rueda (`fetchClassics`), dedupe por lote, clásicos capados a no superar los estrenos frescos, y con el trending agotado se pasan hasta 5 páginas buscando material nuevo. **Cierre de sala**: 30 decisiones por tanda (`DECK_LIMIT`); la tanda arranca con la primera decisión y reabre 12 h después (`DECK_WINDOW_MS`); aviso «quedan N» desde 10, pantalla «La sala cierra un rato» con hora de reapertura, persistida en localStorage.
- **Bibliotecas**: chips de estado con contador, ordenación (Reciente/Estreno/Duración/A-Z), filtro por género (géneros reales de TMDB al añadir).
- **Stats «Tu tiempo en pantalla»**: 10 celdas (horas, pelis, capítulos, series, revisionados, abandonadas, vistas del año, racha, nota media, récord/día) + podio top-3 + ajustes (TMDB plegable, exportar/importar JSON, restablecer).
- **Infraestructura**: carátulas runtime (TVmaze/iTunes sin clave, TMDB con clave) cacheadas; PWA instalable + service worker offline; persistencia y diario de actividad en localStorage; proyecto **Capacitor** completo en `android/` con iconos/splash de marca.

## Estructura

```
src/App.jsx      ← toda la UI y lógica (React)     build.mjs   ← esbuild+Tailwind → index.html, www/, dist/
src/data.js      ← seeds + catálogo offline        index.html  ← build servible (Pages)
src/enrich.js    ← carátulas, TMDB, temporadas     www/        ← webDir de Capacitor (generado)
src/share.js     ← tarjeta canvas compartible      android/    ← proyecto Android Studio (Capacitor)
src/input.css    ← tema @theme + animaciones       tests/      ← smokes Playwright (ver tests/README.md)
pwa/             ← manifest, sw.js, iconos         ANDROID.md  ← guía APK/Play Store · DESIGN.md ← diseño UX/UI
```

Flujo de trabajo: editar `src/` → `npm run build` (o `npm run android` para sincronizar
también el proyecto Android) → `node tests/smoke8.mjs` → commit + push a `main`.

## Siguientes pasos exactos (tarea en curso: publicar en Play Store)

1. **Usuario**: compilar el APK — `npm install && npm run android`, abrir `android/` en
   Android Studio, Build → Build APK(s). Probar en el móvil:
   - la sensación del **swipe** en Descubrir (umbral 70px y rotación 0.05·dx en
     `DiscoverDeck`, `src/App.jsx` — ajustar si se siente duro/blando);
   - el botón **Exportar** dentro del WebView (si no descarga: integrar
     `@capacitor/filesystem` + `@capacitor/share`, ya previsto en ANDROID.md);
   - la tarjeta de **Compartir** con Web Share nativo.
2. **Antes de subir a Play Store** (pendientes de código, por hacer en la próxima sesión):
   - ~~atribución TMDB obligatoria en Stats~~ ✅ hecha (2026-07-10);
   - decidir el `applicationId` definitivo (ahora `com.davedvd.butaca` — inmutable tras publicar);
   - subir `versionCode/versionName` en `android/app/build.gradle` por versión.
3. **Play Store**: keystore + AAB firmado + ficha (política de privacidad análoga a la de
   Tally; declarar las peticiones de red a TMDB/TVmaze/iTunes). Pasos en `ANDROID.md`.
4. **Limpieza opcional**: borrar la rama `claude/media-tracker-app-design-9m1p6o` del repo `tally`.
5. **Ideas encoladas** (no empezadas): pedir nota al terminar algo desde el deck; desglose
   «este año/total» más rico en Stats; notificaciones de nueva temporada como push nativo.

## Convenciones acordadas con el usuario

Idioma: todo en español. Tono cercano. Privacidad primero (nada sale del dispositivo).
El ámbar `#f4b43e` solo para acciones. Mínimos toques para toda acción core. Tras cada
tanda: build + smokes + push + redeploy del Artifact (misma URL, archivo
`dist/artifact.html` — variante sin `<head>` que genera `build.mjs`).
