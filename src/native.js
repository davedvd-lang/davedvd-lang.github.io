// Puente con las capacidades nativas de Android (Capacitor).
//
// Por qué existe: dentro del WebView de Android **no** funcionan dos cosas que en la
// web sí — `navigator.share({files})` (Web Share nivel 2) y la descarga vía
// `<a download>`. Ambas fallan en silencio: el usuario toca el botón y no pasa nada.
// Aquí detectamos si estamos en la app nativa y usamos los plugins de Capacitor.
//
// Todo va envuelto en try/catch con caída a la vía web: si un plugin no cargara,
// la app se comporta como antes en vez de romperse.

/** ¿Estamos dentro de la app nativa (no en el navegador)? */
export function isNative() {
  try {
    return !!(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const s = String(fr.result);
      resolve(s.slice(s.indexOf(",") + 1)); // quita el prefijo data:...;base64,
    };
    fr.readAsDataURL(blob);
  });
}

/**
 * Comparte un archivo. En nativo lo escribe en caché y abre el menú de compartir
 * de Android; en web usa Web Share y, si no hay, descarga.
 * Devuelve "shared" | "downloaded" | "cancelled".
 */
export async function shareBlob(blob, filename, title) {
  if (isNative()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);
      const data = await blobToBase64(blob);
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Cache,
      });
      await Share.share({ title, files: [uri] });
      return "shared";
    } catch (e) {
      // El usuario cerrando el menú de compartir también entra aquí: no es un error.
      if (/cancel/i.test(e?.message || "")) return "cancelled";
      // Si falló el plugin, seguimos con la vía web de abajo.
    }
  }

  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return "downloaded";
}

/**
 * Guarda un archivo (copia de seguridad). En nativo lo deja en Documentos y avisa
 * de dónde está; en web dispara la descarga del navegador.
 * Devuelve "saved" | "downloaded" | "shared" | "cancelled".
 */
export async function saveBlob(blob, filename) {
  if (isNative()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);
      const data = await blobToBase64(blob);
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Cache,
      });
      // Compartir permite al usuario elegir dónde guardarla (Drive, Archivos, correo…),
      // que es más útil que dejarla en una carpeta que quizá no encuentre.
      await Share.share({ title: "Copia de seguridad de Butaca", files: [uri] });
      return "shared";
    } catch (e) {
      if (/cancel/i.test(e?.message || "")) return "cancelled";
    }
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return "downloaded";
}
