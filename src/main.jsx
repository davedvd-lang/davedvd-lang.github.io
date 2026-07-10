import { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

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

createRoot(document.getElementById("root")).render(<Boundary><App /></Boundary>);
