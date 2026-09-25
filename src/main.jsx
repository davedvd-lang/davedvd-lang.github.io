import { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { cancelRestore, restoreFromBackup } from "./backup.js";

/* Red de seguridad: si un render revienta, en vez de una app congelada
   mostramos un aviso con reintento. La videoteca sigue a salvo en localStorage. */
class Boundary extends Component {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-snow">
        <p className="text-4xl">🎞️</p>
        <p className="text-lg font-extrabold tracking-tight">Se ha roto la película</p>
        <p className="text-sm text-fog">Tu videoteca está a salvo en este dispositivo.</p>
        <button
          onClick={() => this.setState({ broken: false })}
          className="rounded-full bg-brass px-5 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95"
        >
          Reintentar
        </button>
      </div>
    );
  }
}

/* Instalación nueva con copia de Android: la videoteca se recupera ANTES del primer
   render, porque App lee localStorage al montar. Con tope de tiempo: si el plugin se
   colgara, la app arranca igual y la restauración tardía se anula (el espejo queda
   intacto y se reintenta en el próximo arranque). Sin copia que restaurar, esto
   resuelve al momento y no retrasa nada. */
const root = createRoot(document.getElementById("root"));
const tope = new Promise((resolve) => setTimeout(() => { cancelRestore(); resolve(); }, 3000));
Promise.race([restoreFromBackup(), tope])
  .catch(() => {})
  .finally(() => root.render(<Boundary><App /></Boundary>));
