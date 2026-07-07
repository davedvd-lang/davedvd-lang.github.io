# Butaca en Android (APK / Play Store)

El proyecto Android ya está montado con [Capacitor](https://capacitorjs.com): la app web
compilada viaja **dentro** del APK (carpeta `www/`), así que funciona 100% offline y no
depende de GitHub Pages.

## Compilar el APK

1. Requisitos: Node 20+, [Android Studio](https://developer.android.com/studio) con un SDK
   de Android instalado (el propio Android Studio lo descarga la primera vez).
2. En la raíz del repo:

   ```bash
   npm install
   npm run android     # compila la web y la sincroniza con el proyecto Android
   ```

3. Abre la carpeta `android/` en Android Studio (**Open an existing project**).
4. Espera a que Gradle sincronice y dale a **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   El APK de debug queda en `android/app/build/outputs/apk/debug/` — instalable
   directamente en tu móvil (activa «instalar apps de orígenes desconocidos»).

Cada vez que cambies la app web: `npm run android` y vuelve a compilar en Android Studio.

## Identidad de la app

- `applicationId`: `com.davedvd.butaca` (cámbialo en `capacitor.config.json` +
  `android/app/build.gradle` si prefieres otro; debe ser único en Play Store y no se
  puede cambiar después de publicar).
- Nombre, icono adaptativo (butaca sobre ámbar) y splash (sala a oscuras) ya están
  aplicados en `android/app/src/main/res/`.

## Subirla a Play Store

1. En Android Studio: **Build → Generate Signed App Bundle** → crea un *keystore* nuevo
   (guárdalo a buen recaudo: sin él no podrás actualizar la app jamás) → formato **AAB**
   (Play Store ya no acepta APK para publicar).
2. En [Play Console](https://play.google.com/console) (tu cuenta de Tally vale): crea la
   app, sube el AAB a una pista (interna → cerrada → producción).
3. Ficha: la política de privacidad de Butaca puede ser análoga a la de Tally (todo
   local, sin cuentas ni analítica). Si activas la búsqueda TMDB, la ficha de datos debe
   declarar que la app hace peticiones de red a TMDB/TVmaze/iTunes (solo títulos
   buscados, sin datos personales) y la app debería mostrar la atribución que pide TMDB
   («This product uses the TMDB API but is not endorsed or certified by TMDB»).
4. Sube `versionCode`/`versionName` en `android/app/build.gradle` en cada actualización.

## Pendiente de probar en el APK

- El botón **Exportar** (descarga de un blob) puede no disparar la descarga dentro del
  WebView de Android. Si pasa, la solución es usar los plugins `@capacitor/filesystem` +
  `@capacitor/share` para guardar/compartir el archivo — pídemelo y lo integro.
