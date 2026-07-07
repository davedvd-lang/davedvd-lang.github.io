// Tarjeta «Acabo de verla» para compartir: canvas → Web Share (móvil) o PNG (descarga).

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // TMDB/TVmaze sirven CORS; si no, caemos al degradado
    img.onload = () => res(img);
    img.onerror = rej;
    setTimeout(rej, 4000);
    img.src = url;
  });
}

export async function shareCard(item, posterUrl) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const font = (px, weight = 700) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  ctx.fillStyle = "#0b0e16";
  ctx.fillRect(0, 0, W, H);

  // póster (imagen real si se puede pintar, degradado + glifo si no)
  const PX = 90, PY = 96, PW = W - 180, PH = 660;
  roundRect(ctx, PX, PY, PW, PH, 48);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(PX, PY, PX + PW, PY + PH);
  g.addColorStop(0, item.poster.from);
  g.addColorStop(1, item.poster.to);
  ctx.fillStyle = g;
  ctx.fillRect(PX, PY, PW, PH);
  let painted = false;
  if (posterUrl) {
    try {
      const img = await loadImage(posterUrl);
      const scale = Math.max(PW / img.width, PH / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, PX + (PW - iw) / 2, PY + (PH - ih) / 2, iw, ih);
      painted = true;
    } catch { /* degradado */ }
  }
  if (!painted) {
    ctx.font = "230px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(item.poster.emoji, W / 2, PY + PH / 2 + 85);
  }
  ctx.restore();

  // título (hasta 2 líneas)
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f2ec";
  ctx.font = font(72, 800);
  const words = item.title.split(" ");
  const lines = [""];
  for (const w of words) {
    const probe = (lines[lines.length - 1] + " " + w).trim();
    if (ctx.measureText(probe).width > W - 200 && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = probe;
  }
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] += "…";
  shown.forEach((l, i) => ctx.fillText(l, W / 2, PY + PH + 130 + i * 84));
  let y = PY + PH + 130 + shown.length * 84;

  // estrellas
  if (item.rating) {
    ctx.font = "84px system-ui";
    let stars = "";
    for (let i = 1; i <= 5; i++) stars += i <= item.rating ? "★" : "☆";
    ctx.fillStyle = "#f4b43e";
    ctx.fillText(stars, W / 2, y + 30);
    y += 110;
  }

  // subtítulo
  ctx.fillStyle = "#97a3bd";
  ctx.font = font(40, 600);
  const times = item.rewatches ? ` · vista ${item.rewatches + 1} veces` : "";
  ctx.fillText(`${item.year} · ${item.type === "movie" ? "película" : "serie"}${times}`, W / 2, y + 26);

  // pie de marca
  ctx.fillStyle = "#f4b43e";
  ctx.font = font(44, 800);
  ctx.fillText("🍿 BUTACA", W / 2, H - 80);

  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const file = new File([blob], `butaca-${slug}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `He visto ${item.title}` });
    return "shared";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
  return "downloaded";
}
