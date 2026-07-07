# Butaca — Diseño UX/UI

Diario personal de series y películas. Sustituye a un rastreador que cierra, con dos
prioridades: **acceso ultrasencillo** (mínimos toques para cualquier acción core) y una
**estética de cine** que invite a entrar a diario.

---

## 1. Arquitectura de la información

```
Butaca
├── Hoy (Dashboard)            ← pantalla de inicio, siempre
│   ├── Sigues viendo          (carrusel: series/pelis en curso + acción "+1 capítulo")
│   ├── Para esta noche        (sugerencias de tu «Por ver» con botón "Empezar")
│   └── Últimas vistas         (historial reciente con tu nota)
├── Películas                  ← biblioteca filtrada por tipo
│   └── Viendo | Por ver | Vistas | Abandonadas   (chips de filtro + ordenación)
├── [+] Añadir                 ← buscador global (overlay, accesible desde todas partes)
├── Series
│   └── Viendo | Por ver | En pausa | Vistas | Abandonadas
│       └── Ficha → Temporadas → rejilla de capítulos
└── Stats                      (horas vistas, pelis, capítulos, series terminadas)
```

**Modelo de datos** (local, sin cuentas — mismo espíritu de privacidad que Tally):

```js
{
  id, type: "movie" | "series",
  title, year, genre, runtime?,          // runtime solo en películas
  status: "watching" | "watchlist" | "paused" | "watched" | "dropped",
  rating?: 1..5,                          // al completar
  addedAt?: epoch_ms,                     // para ordenar por «reciente»
  rewatches?: n,                          // revisionados completados (vista n+1 veces)
  rewatching?: true,                      // revisionado de serie en curso
  seasons?: [{ eps: 9, watched: 6 }, …]   // solo series: progreso por temporada
}
```

**Estados de transición** (la realidad del espectador):
- **En pausa** (solo series): al día y esperando temporada, o simplemente aparcada.
  Sale de «Viendo» para no saturar el dashboard; un atajo bajo «Sigues viendo»
  («⏸ N series en pausa») lleva a la pestaña, y cada tarjeta tiene ▶ para reanudar
  en 1 toque. La ficha distingue «esperando temporada» (al día) de «te quedaste en T_·E_».
- **Abandonada**: conserva el registro de dónde la dejaste («La dejaste en T1·E8»)
  para no volver a picar, fuera de las listas activas. Reversible desde la ficha.
- **Revisionado**: en pelis, un contador «+1 vista otra vez» (badge ×N en la rejilla).
  En series, «Volver a empezar» reinicia el progreso con la marca 🔁 sin tocar el
  historial; al completarla suma un revisionado y vuelve a «Vistas».
- Automatismos: completar la última temporada ⇒ «Vista» (o cierra el revisionado);
  avanzar capítulo de algo en pausa/abandonado lo devuelve a «Viendo».

El estado de una serie y su progreso granular conviven: el "último episodio visto" se
deriva de `seasons` (primera temporada incompleta → siguiente capítulo). No hay estados
duplicados que mantener sincronizados.

## 2. Flujos de usuario (contando toques)

| Acción core | Recorrido | Toques |
|---|---|---|
| **Avanzar capítulo** | Abrir app → botón ámbar «✓ T2·E7 vista» en el dashboard | **1** |
| **Fijar el último cap. visto** (p. ej. te pusiste al día fuera de casa) | Ficha → tocar el episodio en la rejilla (rellena todo lo anterior automáticamente) | 2 |
| **Añadir título** | Botón [+] central → escribir → «Por ver» o «Viendo» en el propio resultado | 2 + texto |
| **Añadir «ya vista» con nota** | [+] → tocar el resultado (ficha preview) → chip «Vista» → estrellas | 3 + texto |
| **Añadir a mitad de serie** | [+] → tocar el resultado → tocar el último capítulo visto en la rejilla | 2 + texto |
| **Empezar algo de la watchlist** | Dashboard → botón ▶ en «Para esta noche» | 1 |
| **Cambiar de estado** | Ficha → control segmentado Por ver / Viendo / Vista | 2 |
| **Terminar una película** | Dashboard → «✓ Terminada» | 1 |
| **Reanudar una serie en pausa** | Pestaña En pausa → ▶ en la tarjeta | 1 |
| **+1 revisionado de una peli** | Ficha → «+1 vista otra vez» | 2 |

Automatismos que ahorran toques:
- Marcar el último capítulo de la serie ⇒ pasa sola a **Vistas** (toast «🏆 ¡Terminada!»).
- Marcar una serie como **Vista** ⇒ completa todas las temporadas.
- Añadir directamente en estado «Viendo» desde el buscador (te saltas la watchlist).
- Tocar de nuevo el último episodio marcado lo desmarca (corregir errores = 1 toque).

## 3. Interfaz visual

### Paleta «sala de cine» (modo oscuro nativo)

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0b0e16` | Fondo — negro azulado, la sala a oscuras |
| `panel` / `panel2` | `#141a28` / `#1b2334` | Tarjetas y superficies elevadas |
| `line` | `#242e46` | Bordes de 1px (profundidad sin sombras duras) |
| `brass` / `brass2` | `#f4b43e` / `#ffd27a` | **Primario**: ámbar de proyector. Solo acciones y progreso |
| `mint` | `#4ade80` | Completado / éxito |
| `snow` / `fog` | `#f4f2ec` / `#97a3bd` | Texto principal (blanco cálido) / secundario |

Regla: el ámbar se reserva para lo accionable (botones, progreso, tab activa); así el ojo
encuentra la acción de un vistazo y la pantalla nunca satura.

### Tipografía
- Prototipo: stack de sistema redondeado (`ui-rounded / SF Pro Rounded / Segoe UI`) —
  cero peso de descarga, se siente nativo.
- Producción sugerida: **Outfit** o **Bricolage Grotesque** para titulares (extrabold,
  tracking apretado) + **Inter** para cuerpo.
- Jerarquía por peso y tamaño, no por color: títulos 26px extrabold, secciones 18px bold,
  metadatos 11–12px en `fog`.

### Microinteracciones
- **Botón «+1 capítulo»**: animación *pop* (escala 1 → .93 → 1.03 → 1) al pulsar; la barra
  de progreso se rellena con `transition-width 500ms ease-out`. Recompensa inmediata.
- **Toasts** contextuales («✓ T2·E7 de “Severance”», «🏆 ¡Terminada!») que suben desde la
  barra de navegación y se desvanecen solos.
- **Bottom sheets** (ficha y buscador) con deslizamiento + fondo desenfocado, patrón móvil
  que mantiene el contexto detrás.
- `active:scale-90/95` en todo lo pulsable: feedback táctil universal.
- Todo respeta `prefers-reduced-motion`.

### Layout del Dashboard («Hoy»)
1. **Cabecera**: saludo según la hora + chips de racha (en curso / pendientes / horas).
2. **Sigues viendo**: carrusel horizontal con *snap*; cada tarjeta = póster, progreso y el
   botón ámbar de acción única. Es lo primero que ves y lo primero que puedes tocar.
3. **Para esta noche**: filas compactas de la watchlist con ▶ para empezar al momento.
4. **Últimas vistas**: tira de pósteres pequeños con tu nota (cierra el ciclo emocional).
5. **Tab bar**: Hoy · Pelis · **[+] flotante central** · Series · Stats.

### Filtros y ordenación
Cada biblioteca ordena por **Reciente** (fecha de añadido, por defecto), **Duración**
(minutos de peli o volumen total de la serie — «¿me caben 90 min o un capítulo?») y
**A–Z**. El filtro por tipo es estructural (pestañas Pelis/Series) y los estados son
chips deslizables con contador. Con orden por duración, la rejilla muestra los minutos.

### Componentes
`Poster` (degradado + glifo, sin imágenes externas) · `ProgressBar` · `Segmented`
(selector de estado) · `WatchingCard` · `TonightRow` · `LibraryGrid` (3 col, aspecto 2/3,
quick-action «✓» superpuesta en Viendo) · `DetailSheet` (ficha con rejilla de episodios)
· `AddSheet` (buscador con alta en 1 toque; tocar el resultado abre la ficha en modo
*preview* — sinopsis, temporadas y estados sin estar aún en la videoteca: la primera
acción dentro la guarda con esa acción ya aplicada) · `TabBar` · `Toast` · `Stars`.

## 4. Estructura del código

```
butaca/
├── index.html      ← prototipo compilado, autocontenido (ábrelo y listo)
├── src/
│   ├── App.jsx     ← toda la UI y la lógica de estado (React 19)
│   ├── data.js     ← biblioteca semilla + catálogo offline, con sinopsis en español
│   ├── enrich.js   ← carátulas reales (TVmaze/iTunes sin clave) y búsqueda online TMDB
│   ├── main.jsx    ← montaje
│   └── input.css   ← tema Tailwind v4 (@theme) + microinteracciones
├── build.mjs       ← esbuild + Tailwind CLI → un solo HTML sin dependencias de red
├── pwa/            ← manifest, service worker e iconos (fuente); build.mjs los copia a la raíz
├── manifest.webmanifest · sw.js · icon-*.png   ← activos PWA servibles
└── package.json
```

Ya implementado sobre el prototipo inicial: persistencia en `localStorage`, sinopsis en
español, carátulas reales en tiempo de ejecución (TVmaze/iTunes, sin clave, con caché y
degradado como placeholder/fallback offline), búsqueda online global con API key de TMDB
(temporadas y duraciones reales al añadir), copia de seguridad exportar/importar JSON, y
PWA instalable con funcionamiento offline (service worker: app shell red-primero,
carátulas caché-primero, APIs siempre en directo).

Segunda tanda de iteraciones: fechas de visionado reales con diario de actividad
(racha de días, vistas del año, récord en un día), ruleta «Sorpréndeme» sobre la
watchlist, notas privadas por título, aviso de nueva temporada vía TMDB (chequeo
diario cacheado + fusión de temporadas conservando el progreso), filtro por género
en las bibliotecas (géneros reales de TMDB al añadir), tarjeta compartible «Acabo
de verla» (canvas → Web Share en móvil / PNG en escritorio), y nota media + podio
personal en Stats. Proyecto Capacitor en android/ para APK y Play Store.
