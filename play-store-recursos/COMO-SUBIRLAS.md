# Subir los recursos gráficos a la ficha de Play Store

Los textos (nombre, descripción breve y descripción completa) **ya están guardados**
en la ficha. Solo faltan las imágenes.

Yo no pude engancharlas: el selector de imágenes de Play Console es un componente
raro que se me resistió (se abría, subía el archivo a la biblioteca, pero no lo
aplicaba al campo). Para ti son un par de minutos de arrastrar y soltar.

## Dónde

Play Console → Butaca → **Aumentar usuarios** → **Fichas de Play Store** →
**Ficha de Play Store predeterminada**

O directo:
https://play.google.com/console/u/0/developers/4695394785777285058/app/4974044478901940174/main-store-listing

## Qué va en cada campo

En cada apartado pulsa **Añadir recursos** → **Subir** → elige los archivos de
esta carpeta. Puedes seleccionar varios a la vez.

| Campo en Play Console | Archivo(s) de esta carpeta |
|---|---|
| **Icono de la aplicación** | `icono-512.png` |
| **Gráfico de funciones** | `grafico-funciones-1024x500.png` |
| **Capturas de pantalla de teléfonos** | `01-hoy.png`, `02-series.png`, `03-stats.png`, `04-peliculas.png` |
| **Capturas para tablets de 7 pulgadas** | los 4 `tablet7-*.png` |
| **Capturas de tablets de 10 pulgadas** | los 4 `tablet10-*.png` |

Nota: el icono `icono-512.png` ya está subido a tu biblioteca de recursos, así que
para ese campo probablemente te salga ya disponible sin volver a subirlo — solo
selecciónalo y dale a **Añadir**.

Al terminar, pulsa **Guardar** abajo a la derecha.

## Mientras estés ahí: un cambio de dos palabras

En la **Descripción completa**, en el bloque «🔒 Privacidad real», cambia esta línea:

- Dice: `Sin cuentas, sin registro, sin publicidad, sin analítica.`
- Debe decir: `Funciona sin cuenta: sin registro obligatorio, sin publicidad, sin analítica.`

Motivo: en la fase 3 habrá cuentas opcionales, y «sin cuentas» pasaría a ser mentira
(y una promesa rota para quien instaló la app justo por eso). Con este matiz sigue
siendo igual de cierto hoy y no te desmiente mañana.

Intenté hacerlo yo, pero Play Console no deja guardar la ficha mientras falten los
recursos gráficos obligatorios — así que en cuanto los subas, este cambio se guarda
con ellos. Ya está aplicado en `privacy.html` y en `ficha-play-store-butaca.md`.

## Sobre las capturas

Las he generado desde la versión web de Butaca con los datos de demo (`?demo`),
que es exactamente la misma app. Cumplen los requisitos de Google. Si algún día
quieres unas hechas en un móvil de verdad, se sustituyen en dos clics.

Las de tablet son las mismas capturas centradas sobre un fondo del color de la app
—no son una versión real para tablet—, pero Google las da por válidas y desbloquean
el formulario. Si más adelante quieres cuidar la presencia en tablets, ahí hay
margen de mejora.

## Lo que queda después de esto

1. **Contenido de la aplicación** (menú Política y programas): política de
   privacidad, acceso a la app, anuncios, clasificación de contenido, público
   objetivo y seguridad de los datos. Las respuestas están en
   `../ficha-play-store-butaca.md`. La URL de la política es
   https://davedvd-lang.github.io/privacy.html
2. **Subir el AAB** a Prueba cerrada (descárgalo de las Releases de GitHub).
3. **Meter a los 12 testers** y arrancar el reloj de 14 días.
