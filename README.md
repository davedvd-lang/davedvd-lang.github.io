# 🍿 Butaca

Diario personal de series y películas, en vivo en **https://davedvd-lang.github.io/**.

Estados **Viendo / Por ver / Vistas** independientes para pelis y series, con seguimiento
por temporada y capítulo de un solo toque. React 19 + Tailwind CSS 4 + Lucide Icons.
Sin cuentas ni servidores: tu biblioteca vive solo en tu dispositivo.

**Instalar en el móvil**: abre la web y usa «Añadir a pantalla de inicio» — es una PWA y
funciona sin conexión.

**Carátulas y sinopsis**: cada título incluye sinopsis en español. Las carátulas reales se
cargan solas con conexión (TVmaze para series, iTunes para películas — sin clave) y se
cachean; sin red se muestra el póster de degradado. Con una API key gratuita de
[TMDB](https://www.themoviedb.org/settings/api) (pestaña **Stats**) el buscador pasa a ser
online y global, con carátulas, sinopsis en español y temporadas reales al añadir una serie.

**Copia de seguridad**: en **Stats** puedes exportar tu biblioteca a un archivo JSON e
importarla en otro dispositivo.

**App Android (APK / Play Store)**: el proyecto Capacitor está en `android/` — abre esa
carpeta en Android Studio y dale a Build. Instrucciones completas en [ANDROID.md](ANDROID.md).

**Desarrollar**:

```bash
npm install
npm run build   # regenera index.html desde src/
```

Las decisiones de diseño (arquitectura de información, flujos, paleta, microinteracciones)
están documentadas en [DESIGN.md](DESIGN.md).
