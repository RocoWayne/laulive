// ============================================================
// Fuente de navegador OBS
// Reproductor de música 24/7 + bloques de noticias con QR
// ============================================================

const CONFIG = {
  musicScanUrl: "music/playlist.php", // metodo principal: escanea /music en vivo (requiere PHP)
  musicDirUrl: "music/",              // respaldo: listado de directorio del server (sin PHP)
  playlistUrl: "music/playlist.json", // overrides de titulo/artista + respaldo si no hay PHP ni listado
  newsUrl: "news/news.json",
  backgroundsScanUrl: "backgrounds/playlist.php", // metodo principal: escanea /backgrounds en vivo (requiere PHP)
  backgroundsDirUrl: "backgrounds/",              // respaldo: listado de directorio del server (sin PHP)
  backgroundsPlaylistUrl: "backgrounds/playlist.json", // respaldo si no hay PHP ni listado
  playlistRefreshMs: 2 * 60 * 1000,   // re-chequear /music cada 2 min
  newsRefreshMs: 3 * 60 * 1000,       // releer news.json cada 3 min
  newsIntervalMs: 15 * 60 * 1000,     // cada cuanto se dispara un bloque de noticias
  newsItemsPerBlock: 2,                // cuantas noticias seguidas se muestran en cada bloque
  newsDisplayMs: 30 * 1000,           // cuánto queda visible cada noticia dentro del bloque
  backgroundsRefreshMs: 2 * 60 * 1000,  // re-chequear /backgrounds cada 2 min
  backgroundImageDurationMs: 35 * 1000, // cuanto queda cada imagen antes de pasar a la siguiente
  qrSize: 200,
  subscribeFirstDelayMs: 60 * 1000,     // primera aparicion: al minuto de abrir la pagina
  subscribeIntervalMs: 10 * 60 * 1000,  // despues, cada 10 minutos
  subscribeDisplayMs: 15 * 1000,        // cuanto queda visible cada vez
};

const VALID_AUDIO_EXT = [".mp3", ".m4a", ".ogg", ".wav", ".flac"];
const VALID_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VALID_VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const VALID_BACKGROUND_EXT = [...VALID_IMAGE_EXT, ...VALID_VIDEO_EXT];

// ---------------- Reproductor ----------------

const audio = document.getElementById("audio");
const trackTitleEl = document.getElementById("trackTitle");
const trackArtistEl = document.getElementById("trackArtist");
const progressFill = document.getElementById("progressFill");
const playerEl = document.getElementById("player");
const autoplayGate = document.getElementById("autoplayGate");
const autoplayBtn = document.getElementById("autoplayBtn");

let playlist = [];
let history = [];
let currentTrack = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextTrack() {
  if (playlist.length === 0) return null;
  if (playlist.length === 1) return playlist[0];

  let pool = playlist;
  if (currentTrack) {
    pool = playlist.filter((t) => t.file !== currentTrack.file);
  }
  const shuffled = shuffle(pool);
  return shuffled[0];
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.[^/.]+$/, "");
  const parts = base.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", title: base.trim() };
}

// Lee el listado de directorio que sirve el servidor HTTP para una
// carpeta dada (funciona con `python3 -m http.server`, Apache/nginx con
// autoindex, etc.) y devuelve los nombres de archivo que matcheen las
// extensiones validas pasadas.
async function scanDirectory(dirUrl, validExts) {
  try {
    const res = await fetch(dirUrl + "?t=" + Date.now());
    if (!res.ok) throw new Error("No se pudo listar " + dirUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    const files = anchors
      .map((a) => {
        try {
          const url = new URL(a.getAttribute("href"), location.href);
          return decodeURIComponent(url.pathname.split("/").pop());
        } catch {
          return null;
        }
      })
      .filter((name) => {
        if (!name) return false;
        const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
        return validExts.includes(ext);
      });
    // sin duplicados
    return Array.from(new Set(files));
  } catch (err) {
    console.warn(`No se pudo auto-escanear ${dirUrl} (¿autoindex deshabilitado?):`, err);
    return [];
  }
}

function scanMusicDirectory() {
  return scanDirectory(CONFIG.musicDirUrl, VALID_AUDIO_EXT);
}

// Metodo PRINCIPAL: music/playlist.php escanea la carpeta /music en
// vivo, en cada request (ver ese archivo). Funciona en cualquier
// hosting con PHP, WordPress incluido, sin depender de que el server
// liste directorios ni de correr ningun script a mano: basta con subir
// o borrar mp3s en /music.
async function loadPlaylistFromPhp() {
  try {
    const res = await fetch(CONFIG.musicScanUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.filter((t) => t && t.file);
  } catch {
    return null; // PHP no disponible en este hosting (ej. server estatico local)
  }
}

// Metodo de RESPALDO (sin PHP): playlist.json generado a mano con
// scripts/generate_playlist.py. Devuelve tanto la lista de archivos
// como overrides de titulo/artista para cada uno.
async function loadDeclaredPlaylist() {
  try {
    const res = await fetch(CONFIG.playlistUrl + "?t=" + Date.now());
    if (!res.ok) return {};
    const data = await res.json();
    const tracks = Array.isArray(data) ? data : data.tracks || [];
    const map = {};
    for (const t of tracks) {
      if (typeof t === "string") {
        map[t] = {};
      } else if (t.file) {
        map[t.file] = t;
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function loadPlaylist() {
  const phpTracks = await loadPlaylistFromPhp();
  if (phpTracks && phpTracks.length > 0) {
    playlist = phpTracks.map((t) => {
      const parsed = titleFromFilename(t.file);
      return {
        file: t.file,
        title: t.title || parsed.title,
        artist: t.artist || parsed.artist,
      };
    });
    return;
  }

  const declared = await loadDeclaredPlaylist();
  let sourceFiles = Object.keys(declared);

  // Fallback SOLO para pruebas locales sin PHP: si playlist.json
  // todavia no fue generado (o esta vacio), intentamos auto-escanear
  // /music. Esto requiere que el servidor liste directorios (funciona
  // con `python3 -m http.server`), algo que casi ningun hosting de
  // produccion tiene habilitado.
  if (sourceFiles.length === 0) {
    sourceFiles = await scanMusicDirectory();
  }

  playlist = sourceFiles.map((file) => {
    const parsed = titleFromFilename(file);
    const override = declared[file] || {};
    return {
      file,
      title: override.title || parsed.title,
      artist: override.artist || parsed.artist,
    };
  });
}

function updateNowPlayingUI(track) {
  playerEl.classList.add("fading");
  setTimeout(() => {
    trackTitleEl.textContent = track.title || track.file;
    trackArtistEl.textContent = track.artist || "";
    playerEl.classList.remove("fading");
  }, 220);
}

function playTrack(track) {
  if (!track) return;
  currentTrack = track;
  audio.src = "music/" + encodeURIComponent(track.file);
  audio.play().catch((err) => {
    console.warn("Autoplay bloqueado, esperando interacción:", err);
    autoplayGate.classList.remove("hidden");
  });
  updateNowPlayingUI(track);
}

function playNext() {
  const next = pickNextTrack();
  if (next) playTrack(next);
}

audio.addEventListener("ended", playNext);
audio.addEventListener("error", () => {
  console.warn("Error reproduciendo, salto a la siguiente canción.");
  setTimeout(playNext, 800);
});
audio.addEventListener("timeupdate", () => {
  if (audio.duration) {
    progressFill.style.width = (audio.currentTime / audio.duration) * 100 + "%";
  }
});

autoplayBtn.addEventListener("click", () => {
  autoplayGate.classList.add("hidden");
  audio.play();
});

setInterval(async () => {
  await loadPlaylist();
}, CONFIG.playlistRefreshMs);

// ---------------- Reloj ----------------

const clockEl = document.getElementById("clock");
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}`;
}
tickClock();
setInterval(tickClock, 15000);

// ---------------- Noticias ----------------
// Pantalla completa que reemplaza el fondo de publicidades mientras
// esta activa. Se muestran CONFIG.newsItemsPerBlock noticias seguidas
// ("bloque"), pausando el slideshow de /backgrounds, y al terminar el
// bloque el slideshow continua solo. Arranca con un bloque apenas
// carga la pagina, y despues se repite cada CONFIG.newsIntervalMs.

const newsScreen = document.getElementById("newsScreen");
const newsImage = document.getElementById("newsImage");
const newsText = document.getElementById("newsText");
const newsQr = document.getElementById("newsQr");

let newsList = [];
let newsIndex = 0;
let newsBlockRunning = false;

async function loadNews() {
  try {
    const res = await fetch(CONFIG.newsUrl + "?t=" + Date.now());
    if (!res.ok) throw new Error("No se pudo cargar news.json");
    const data = await res.json();
    newsList = Array.isArray(data) ? data : data.news || [];
  } catch (err) {
    console.error("Error cargando noticias:", err);
    newsList = [];
  }
}

function qrUrlFor(link) {
  const encoded = encodeURIComponent(link);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${CONFIG.qrSize}x${CONFIG.qrSize}&data=${encoded}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Muestra una noticia y espera CONFIG.newsDisplayMs antes de resolver.
function showNewsItem(item) {
  if (!item || (!item.text && !item.image)) return Promise.resolve();

  // Si la imagen no carga (link roto, 404), la ocultamos en vez de
  // mostrar el ícono de imagen rota.
  if (item.image) {
    newsImage.onerror = () => { newsImage.style.display = "none"; };
    newsImage.onload = () => { newsImage.style.display = ""; };
    newsImage.src = item.image;
  } else {
    newsImage.style.display = "none";
  }

  newsText.textContent = item.text || "";

  if (item.link) {
    newsQr.src = qrUrlFor(item.link);
    newsScreen.classList.remove("no-link");
  } else {
    newsScreen.classList.add("no-link");
  }

  newsScreen.classList.add("visible");
  return wait(CONFIG.newsDisplayMs);
}

// Corre un bloque completo de noticias: pausa el slideshow de fondos,
// muestra hasta newsItemsPerBlock noticias una atras de otra, y al
// terminar retoma el slideshow. Si no hay noticias cargadas, no hace
// nada mas que asegurarse de que el slideshow este corriendo.
async function runNewsBlock() {
  if (newsBlockRunning) return;
  newsBlockRunning = true;
  pauseBackgroundRotation();

  if (newsList && newsList.length > 0) {
    const count = Math.min(CONFIG.newsItemsPerBlock, newsList.length);
    for (let i = 0; i < count; i++) {
      const item = newsList[newsIndex % newsList.length];
      newsIndex++;
      await showNewsItem(item);
      newsScreen.classList.remove("visible");
      await wait(700); // pausa breve entre una noticia y la siguiente
    }
  }

  newsBlockRunning = false;
  resumeBackgroundRotation();
}

setInterval(async () => {
  await loadNews();
}, CONFIG.newsRefreshMs);

setInterval(runNewsBlock, CONFIG.newsIntervalMs);

// ---------------- Fondos rotativos (publicidades) ----------------
// Imagenes y video mudo de /backgrounds, a pantalla completa detras de
// todo lo demas. Mismo esquema de 3 metodos que la musica: PHP en vivo
// (WordPress) > backgrounds/playlist.json (GitHub Pages) > auto-escaneo
// de directorio (solo pruebas locales).

const bgImage = document.getElementById("bgImage");
const bgVideo = document.getElementById("bgVideo");

let backgrounds = [];
let currentBackground = null;
let bgAdvanceTimer = null;

function backgroundType(file) {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  if (VALID_VIDEO_EXT.includes(ext)) return "video";
  if (VALID_IMAGE_EXT.includes(ext)) return "image";
  return null;
}

async function loadBackgroundsFromPhp() {
  try {
    const res = await fetch(CONFIG.backgroundsScanUrl + "?t=" + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data
      .map((t) => (typeof t === "string" ? t : t.file))
      .filter(Boolean);
  } catch {
    return null; // PHP no disponible en este hosting
  }
}

async function loadBackgroundsFromJson() {
  try {
    const res = await fetch(CONFIG.backgroundsPlaylistUrl + "?t=" + Date.now());
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.files || [];
    return list.map((t) => (typeof t === "string" ? t : t.file)).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadBackgrounds() {
  let files = await loadBackgroundsFromPhp();

  if (!files || files.length === 0) {
    files = await loadBackgroundsFromJson();
  }
  if (files.length === 0) {
    files = await scanDirectory(CONFIG.backgroundsDirUrl, VALID_BACKGROUND_EXT);
  }

  backgrounds = files
    .map((file) => ({ file, type: backgroundType(file) }))
    .filter((item) => item.type !== null);
}

function pickNextBackground() {
  if (backgrounds.length === 0) return null;
  if (backgrounds.length === 1) return backgrounds[0];

  let pool = backgrounds;
  if (currentBackground) {
    pool = backgrounds.filter((b) => b.file !== currentBackground.file);
  }
  return shuffle(pool)[0];
}

function advanceBackground() {
  if (bgAdvanceTimer) {
    clearTimeout(bgAdvanceTimer);
    bgAdvanceTimer = null;
  }
  const next = pickNextBackground();
  if (next) showBackground(next);
}

function showBackground(item) {
  currentBackground = item;
  const src = CONFIG.backgroundsDirUrl + encodeURIComponent(item.file);

  if (item.type === "video") {
    bgImage.classList.remove("active");
    bgVideo.onended = advanceBackground;
    bgVideo.onerror = () => setTimeout(advanceBackground, 1000);
    bgVideo.src = src;
    bgVideo.currentTime = 0;
    bgVideo.play().catch(() => setTimeout(advanceBackground, 1000));
    bgVideo.classList.add("active");
  } else {
    bgVideo.pause();
    bgVideo.classList.remove("active");
    bgImage.onload = () => bgImage.classList.add("active");
    bgImage.onerror = () => setTimeout(advanceBackground, 500);
    bgImage.src = src;
    bgAdvanceTimer = setTimeout(advanceBackground, CONFIG.backgroundImageDurationMs);
  }
}

// Pausa el slideshow de fondos (usado mientras se muestra un bloque de
// noticias, que ocupa toda la pantalla y lo tapa). No hace falta
// ocultar nada explicitamente: la pantalla de noticias ya cubre todo.
function pauseBackgroundRotation() {
  if (bgAdvanceTimer) {
    clearTimeout(bgAdvanceTimer);
    bgAdvanceTimer = null;
  }
  if (!bgVideo.paused) bgVideo.pause();
}

// Retoma el slideshow de fondos despues de un bloque de noticias (o lo
// arranca por primera vez).
function resumeBackgroundRotation() {
  advanceBackground();
}

setInterval(async () => {
  await loadBackgrounds();
}, CONFIG.backgroundsRefreshMs);

// ---------------- Popup de suscripción ----------------
// Desciende desde el centro-arriba, queda visible subscribeDisplayMs
// y vuelve a subir. Arranca al minuto de abrir la pagina y despues se
// repite cada subscribeIntervalMs.

const subscribePopup = document.getElementById("subscribePopup");

function showSubscribePopup() {
  // Evitamos superponerlo con la pantalla de noticias a pantalla
  // completa; si coincide, se salta esta vez y aparece en el proximo turno.
  if (newsBlockRunning) return;

  subscribePopup.classList.add("visible");
  setTimeout(() => {
    subscribePopup.classList.remove("visible");
  }, CONFIG.subscribeDisplayMs);
}

setTimeout(() => {
  showSubscribePopup();
  setInterval(showSubscribePopup, CONFIG.subscribeIntervalMs);
}, CONFIG.subscribeFirstDelayMs);

// ---------------- Arranque ----------------

(async function start() {
  await Promise.all([loadPlaylist(), loadNews(), loadBackgrounds()]);
  if (playlist.length > 0) playNext();
  else {
    trackTitleEl.textContent = "Sin canciones en /music";
    trackArtistEl.textContent = "Agregá archivos y actualizá playlist.json";
  }
  // Arranca con un bloque de noticias (newsItemsPerBlock seguidas); al
  // terminar, el propio bloque deja andando el slideshow de fondos.
  // El próximo bloque de noticias es a los newsIntervalMs desde acá.
  await runNewsBlock();
})();
