// Datos locales de ejemplo (mock). Las carátulas reales se cargan en tiempo de
// ejecución (src/enrich.js) y el degradado + glifo actúa como placeholder/fallback.

let _id = 0;
const id = () => ++_id;
const daysAgo = (n) => Date.now() - n * 864e5;

export const seedLibrary = [
  {
    id: id(), type: "series", title: "Severance", year: 2022, genre: "Sci-Fi · Thriller",
    addedAt: daysAgo(3),
    poster: { from: "#1d4ed8", to: "#0f172a", emoji: "🗂️" },
    synopsis: "Los empleados de Lumon se someten a un procedimiento que separa sus recuerdos del trabajo y de su vida personal. Cuando ambas mitades empiezan a hacerse preguntas, el muro entre ellas se resquebraja.",
    status: "watching",
    seasons: [{ eps: 9, watched: 9 }, { eps: 10, watched: 6 }],
  },
  {
    id: id(), type: "series", title: "The Bear", year: 2022, genre: "Drama · Cocina",
    addedAt: daysAgo(9),
    poster: { from: "#b45309", to: "#1c1917", emoji: "🔪" },
    synopsis: "Un joven chef de alta cocina vuelve a Chicago para hacerse cargo de la bocadillería familiar tras la muerte de su hermano. Caos, deudas y una cocina que grita «¡sí, chef!».",
    status: "watching",
    seasons: [{ eps: 8, watched: 8 }, { eps: 10, watched: 10 }, { eps: 10, watched: 2 }],
  },
  {
    id: id(), type: "series", title: "Dark", year: 2017, genre: "Sci-Fi · Misterio",
    addedAt: daysAgo(30),
    poster: { from: "#334155", to: "#020617", emoji: "🕳️" },
    synopsis: "La desaparición de dos niños en Winden destapa las relaciones rotas de cuatro familias… y un viaje en el tiempo que conecta 1953, 1986 y 2019. Todo está conectado.",
    status: "watching",
    seasons: [{ eps: 10, watched: 10 }, { eps: 8, watched: 3 }, { eps: 8, watched: 0 }],
  },
  {
    id: id(), type: "movie", title: "Dune: Parte Dos", year: 2024, genre: "Sci-Fi · Aventura", runtime: 166,
    addedAt: daysAgo(1),
    poster: { from: "#d97706", to: "#292524", emoji: "🏜️" },
    synopsis: "Paul Atreides se une a los Fremen para vengar a su familia mientras el mito del Lisan al-Gaib crece a su alrededor. La guerra por Arrakis — y por el destino del universo — comienza.",
    status: "watchlist",
  },
  {
    id: id(), type: "movie", title: "La La Land", year: 2016, genre: "Musical · Romance", runtime: 128,
    addedAt: daysAgo(12),
    poster: { from: "#7c3aed", to: "#1e1b4b", emoji: "🎹" },
    synopsis: "Una aspirante a actriz y un pianista de jazz se enamoran en Los Ángeles mientras persiguen sus sueños. Un musical sobre lo que cuesta elegir entre el amor y la ambición.",
    status: "watchlist",
  },
  {
    id: id(), type: "movie", title: "Oldboy", year: 2003, genre: "Thriller", runtime: 120,
    addedAt: daysAgo(21),
    poster: { from: "#b91c1c", to: "#1c1917", emoji: "🔨" },
    synopsis: "Encerrado quince años sin saber por qué, Oh Dae-su es liberado de repente y tiene cinco días para descubrir quién lo encerró. La venganza es solo el principio.",
    status: "watchlist",
  },
  {
    id: id(), type: "series", title: "Fleabag", year: 2016, genre: "Comedia · Drama",
    addedAt: daysAgo(5),
    poster: { from: "#be185d", to: "#1f1720", emoji: "🦊" },
    synopsis: "Una londinense sarcástica y autodestructiva nos habla directamente a cámara mientras intenta sobrevivir al duelo, a su familia y a sí misma. Divertidísima hasta que duele.",
    status: "watchlist",
    seasons: [{ eps: 6, watched: 0 }, { eps: 6, watched: 0 }],
  },
  {
    id: id(), type: "series", title: "Chernobyl", year: 2019, genre: "Drama histórico",
    addedAt: daysAgo(15),
    poster: { from: "#65a30d", to: "#111827", emoji: "☢️" },
    synopsis: "Abril de 1986: el reactor 4 de Chernóbil explota y la URSS intenta ocultar la verdad. La historia de los que lo pagaron con su vida y de los que se negaron a callar.",
    status: "watchlist",
    seasons: [{ eps: 5, watched: 0 }],
  },
  {
    id: id(), type: "movie", title: "Parásitos", year: 2019, genre: "Thriller · Drama", runtime: 132,
    addedAt: daysAgo(60),
    poster: { from: "#0d9488", to: "#111827", emoji: "🪨" },
    synopsis: "La familia Kim, en paro, se infiltra empleo a empleo en la casa de los adinerados Park. Una sátira feroz sobre la desigualdad que muta de comedia a pesadilla sin avisar.",
    status: "watched", rating: 5,
  },
  {
    id: id(), type: "movie", title: "Whiplash", year: 2014, genre: "Drama · Música", runtime: 106, rewatches: 2,
    addedAt: daysAgo(90),
    poster: { from: "#f59e0b", to: "#18181b", emoji: "🥁" },
    synopsis: "Un joven baterista de jazz choca con el profesor más brutal del conservatorio, dispuesto a todo con tal de encontrar a su próximo genio. ¿Hasta dónde llega la excelencia?",
    status: "watched", rating: 5,
  },
  {
    id: id(), type: "movie", title: "Her", year: 2013, genre: "Romance · Sci-Fi", runtime: 126,
    addedAt: daysAgo(45),
    poster: { from: "#e11d48", to: "#2a1218", emoji: "📱" },
    synopsis: "En un futuro cercano, un hombre solitario que escribe cartas de amor ajenas se enamora de su sistema operativo. Una historia de amor tan tierna como inquietante.",
    status: "watched", rating: 4,
  },
  {
    id: id(), type: "series", title: "The Last of Us", year: 2023, genre: "Drama · Postapocalíptico",
    addedAt: daysAgo(200),
    poster: { from: "#166534", to: "#0c0a09", emoji: "🍄" },
    synopsis: "Veinte años después de que un hongo arrasara la civilización, Joel debe escoltar a Ellie, una adolescente que puede ser la clave de todo, a través de unos Estados Unidos en ruinas.",
    status: "paused",
    seasons: [{ eps: 9, watched: 9 }, { eps: 7, watched: 7 }],
  },
  {
    id: id(), type: "series", title: "Perdidos", year: 2004, genre: "Misterio · Aventura",
    addedAt: daysAgo(300),
    poster: { from: "#0e7490", to: "#0c0a09", emoji: "🏝️" },
    synopsis: "Los supervivientes del vuelo Oceanic 815 se estrellan en una isla que no aparece en ningún mapa. Cada respuesta abre tres preguntas nuevas.",
    status: "dropped",
    seasons: [{ eps: 24, watched: 8 }],
  },
  {
    id: id(), type: "series", title: "Succession", year: 2018, genre: "Drama",
    addedAt: daysAgo(75),
    poster: { from: "#475569", to: "#0c0a09", emoji: "🏢" },
    synopsis: "Los cuatro hijos del magnate Logan Roy se disputan el control de su imperio mediático mientras él se niega a soltarlo. Shakespeare con jet privado y puñaladas en cada consejo.",
    status: "watched", rating: 5,
    seasons: [{ eps: 10, watched: 10 }, { eps: 10, watched: 10 }, { eps: 9, watched: 9 }, { eps: 10, watched: 10 }],
  },
];

// Catálogo local para el buscador sin conexión ni clave.
// Con una API key de TMDB (pestaña Stats) el buscador pasa a ser online y global.
export const catalog = [
  { type: "series", title: "Andor", year: 2022, genre: "Sci-Fi · Drama", poster: { from: "#0369a1", to: "#0c0a09", emoji: "🛰️" }, synopsis: "Cassian Andor pasa de ladrón buscavidas a pieza clave de la rebelión contra el Imperio. Star Wars sin jedis: espionaje, prisiones y el precio de resistir.", seasons: [{ eps: 12, watched: 0 }, { eps: 12, watched: 0 }] },
  { type: "movie", title: "Interstellar", year: 2014, genre: "Sci-Fi", runtime: 169, poster: { from: "#155e75", to: "#020617", emoji: "🌌" }, synopsis: "Con la Tierra muriéndose, un expiloto deja atrás a su hija para cruzar un agujero de gusano en busca de un nuevo hogar. El amor y la gravedad atraviesan dimensiones." },
  { type: "series", title: "True Detective", year: 2014, genre: "Crimen · Drama", poster: { from: "#a16207", to: "#0c0a09", emoji: "🔦" }, synopsis: "Antología criminal: cada temporada, unos detectives distintos y un caso que los consume. La primera, con Rust Cohle y Marty Hart en Luisiana, es ya leyenda.", seasons: [{ eps: 8, watched: 0 }, { eps: 8, watched: 0 }, { eps: 8, watched: 0 }, { eps: 6, watched: 0 }] },
  { type: "movie", title: "El Padrino", year: 1972, genre: "Crimen · Drama", runtime: 175, poster: { from: "#7f1d1d", to: "#0c0a09", emoji: "🌹" }, synopsis: "El envejecido don Vito Corleone traspasa el control de su imperio criminal a su hijo Michael, que juró no mancharse las manos. La obra maestra del cine de mafia." },
  { type: "series", title: "Arcane", year: 2021, genre: "Animación · Fantasía", poster: { from: "#4f46e5", to: "#1e1b4b", emoji: "⚗️" }, synopsis: "Dos hermanas, Vi y Jinx, acaban en bandos opuestos de la guerra entre la próspera Piltover y el oprimido subsuelo de Zaun. Animación deslumbrante, corazón roto garantizado.", seasons: [{ eps: 9, watched: 0 }, { eps: 9, watched: 0 }] },
  { type: "movie", title: "Blade Runner 2049", year: 2017, genre: "Sci-Fi", runtime: 164, poster: { from: "#ea580c", to: "#1c1917", emoji: "🌆" }, synopsis: "El agente K, un blade runner replicante, destapa un secreto enterrado hace décadas que puede romper la frontera entre humanos y máquinas. Neonoir majestuoso." },
  { type: "series", title: "Shōgun", year: 2024, genre: "Drama histórico", poster: { from: "#9f1239", to: "#18181b", emoji: "⚔️" }, synopsis: "Japón, 1600: un marinero inglés naufraga en medio de la lucha por el poder entre señores feudales. Política, honor y traducción como arma en la corte de Toranaga.", seasons: [{ eps: 10, watched: 0 }] },
  { type: "movie", title: "Coherence", year: 2013, genre: "Sci-Fi · Misterio", runtime: 89, poster: { from: "#5b21b6", to: "#0f0a1e", emoji: "☄️" }, synopsis: "Durante una cena entre amigos, el paso de un cometa empieza a duplicar realidades. Sci-fi de salón, rodada con cuatro duros y capaz de retorcerte el cerebro." },
];
