// Copia de seguridad automática en la cuenta de Google (Android).
//
// Por qué existe: a una usuaria le robaron el móvil y perdió toda su videoteca.
// Android ya tenía activada la copia automática (`allowBackup="true"`), pero copiaba
// TODO el directorio de la app — incluida la caché de carátulas del WebView, que
// crece sin límite. En cuanto pasa de los 25 MB que Android admite por app, la
// copia falla entera, en silencio. Con meses de uso eso ocurre seguro.
//
// La solución: la app deja un espejo pequeño de la videoteca en `butaca-backup.json`
// (directorio de datos de la app) y las reglas de android/app/src/main/res/xml/ le
// dicen a Android que copie SOLO ese archivo. Pasa de «cientos de MB que fallan» a
// «unos KB que siempre caben». Al instalar Butaca en un móvil nuevo con la misma
// cuenta de Google, Android restaura el archivo y `restoreFromBackup()` rehace la
// videoteca antes del primer render.
//
// Todo va envuelto en try/catch: si el plugin fallara, la app sigue como siempre.

import { isNative } from "./native.js";

export const BACKUP_FILE = "butaca-backup.json";

// Mismas claves que App.jsx (smoke22 comprueba la restauración de punta a punta,
// así que un cambio de clave sin tocar aquí rompería el test).
const LIB_KEY = "butaca:lib:v1";
const ACT_KEY = "butaca:activity:v1";
const WELCOME_KEY = "butaca:welcome:v1";

/** Solo en la app nativa: es la copia de Android. Los tests activan el mismo camino
    en el navegador (con la implementación web del plugin) mediante el interruptor. */
export const backupEnabled = () => isNative() || window.__BUTACA_BACKUP_TEST__ === true;

async function fs() {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  return { Filesystem, Directory, Encoding };
}

let timer = null;
let pending = null;
let sawData = false; // ¿ha habido títulos en esta sesión?

/**
 * Programa la escritura del espejo (se agrupan los cambios seguidos).
 *
 * Un espejo VACÍO solo se escribe si en esta sesión hubo títulos, es decir, si has
 * vaciado tú la videoteca. Si no, en un móvil nuevo cuya restauración fallara o
 * tardara, la app arrancaría vacía y machacaría la copia buena que Android acaba
 * de devolver — justo lo contrario de lo que queremos.
 */
export function scheduleMirror(state) {
  if (!backupEnabled()) return;
  const empty = !state?.library?.length;
  if (empty && !sawData) return;
  if (!empty) sawData = true;
  pending = state;
  clearTimeout(timer);
  // vaciado: al instante, para que un cierre brusco no resucite lo borrado
  if (empty) flushMirror();
  else timer = setTimeout(flushMirror, 1200);
}

export async function flushMirror() {
  clearTimeout(timer);
  const state = pending;
  pending = null;
  if (!state) return;
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    await Filesystem.writeFile({
      path: BACKUP_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: JSON.stringify({ app: "butaca", version: 1, savedAt: new Date().toISOString(), ...state }),
    });
  } catch { /* sin espacio o sin plugin: se reintenta con el próximo cambio */ }
}

// al pasar a segundo plano (o cerrar la app) que no quede nada pendiente
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushMirror();
  });
}

let restored = 0;
let cancelled = false;

/** Cuántos títulos se recuperaron al arrancar (se consume una sola vez). */
export function takeRestoredCount() {
  const n = restored;
  restored = 0;
  return n;
}

/** Si la restauración llega tarde (tope de main.jsx), que no escriba: la app ya
    arrancó vacía y el espejo sigue intacto para el próximo arranque. */
export function cancelRestore() {
  cancelled = true;
}

function localLibraryIsEmpty() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIB_KEY));
    return !(Array.isArray(saved) && saved.length);
  } catch {
    return true;
  }
}

/**
 * Antes del primer render: si la videoteca local está vacía (instalación nueva) y
 * hay espejo con títulos, lo vuelca a localStorage. Nunca pisa datos existentes.
 */
export async function restoreFromBackup() {
  if (!backupEnabled() || !localLibraryIsEmpty()) return;
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    const { data } = await Filesystem.readFile({
      path: BACKUP_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const snap = JSON.parse(typeof data === "string" ? data : await data.text());
    if (snap?.app !== "butaca" || !Array.isArray(snap.library) || !snap.library.length) return;
    if (cancelled || !localLibraryIsEmpty()) return;
    localStorage.setItem(LIB_KEY, JSON.stringify(snap.library));
    if (snap.activity && typeof snap.activity === "object") {
      localStorage.setItem(ACT_KEY, JSON.stringify(snap.activity));
    }
    localStorage.setItem(WELCOME_KEY, "1"); // quien recupera su videoteca ya conoce la app
    restored = snap.library.length;
  } catch { /* sin espejo (primera instalación de verdad) o ilegible: arranque normal */ }
}
