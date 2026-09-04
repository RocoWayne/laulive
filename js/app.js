// ============================================================
// Laura Ubfal Live — fuente de navegador OBS
// Reproductor de música 24/7 + overlay de noticias con QR
// ============================================================

const CONFIG = {
  musicDirUrl: "music/",              // se auto-escanea (listado de directorio del server)
  playlistUrl: "music/playlist.json", // opcional: solo para overrides de titulo/artista
  newsUrl: "news/news.json",
  playlistRefreshMs: 2 * 60 * 1000,   // re-escanear /music cada 2 min
  newsRefreshMs: 3 * 60 * 1000,       // releer news.json cada 3 min
  newsIntervalMs: 6 * 60 * 1000,      // mostrar una noticia cada 6 min
  newsDisplayMs: 25 * 1000,           // cuánto queda visible cada noticia
  qrSize: 200,
};

const VALID_AUDIO_EXT = [".mp3", ".m4a", ".ogg", ".wav", ".flac"];

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

// Lee el listado de directorio que sirve el servidor HTTP para /music/
// (funciona con `python3 -m http.server`, Apache/nginx con autoindex, etc.)
// y devuelve los nombres de archivo de audio encontrados.
async function scanMusicDirectory() {
  try {
    const res = await fetch(CONFIG.musicDirUrl + "?t=" + Date.now());
    if (!res.ok) throw new Error("No se pudo listar " + CONFIG.musicDirUrl);
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
        return VALID_AUDIO_EXT.includes(ext);
      });
    // sin duplicados
    return Array.from(new Set(files));
  } catch (err) {
    console.warn("No se pudo auto-escanear /music (¿autoindex deshabilitado?):", err);
    return [];
  }
}

// playlist.json (generado por scripts/generate_playlist.py) es la fuente
// PRINCIPAL de la playlist: funciona en cualquier hosting, incluido
// WordPress, donde el listado automático de directorio suele estar
// deshabilitado. Devuelve tanto la lista de archivos como overrides de
// título/artista para cada uno.
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
  const declared = await loadDeclaredPlaylist();
  let sourceFiles = Object.keys(declared);

  // Fallback SOLO para pruebas locales: si playlist.json todavía no fue
  // generado (o está vacío), intentamos auto-escanear /music. Esto
  // requiere que el servidor liste directorios (funciona con
  // `python3 -m http.server`), algo que la mayoría de los hostings de
  // producción (WordPress incluido) tienen deshabilitado.
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

const newsCard = document.getElementById("newsCard");
const newsImage = document.getElementById("newsImage");
const newsText = document.getElementById("newsText");
const newsQr = document.getElementById("newsQr");

let newsList = [];
let newsIndex = 0;

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

function showNews() {
  if (!newsList || newsList.length === 0) return;
  const item = newsList[newsIndex % newsList.length];
  newsIndex++;

  newsImage.src = item.image || "";
  newsText.textContent = item.text || "";
  newsQr.src = item.link ? qrUrlFor(item.link) : "";

  newsCard.classList.add("visible");

  setTimeout(() => {
    newsCard.classList.remove("visible");
  }, CONFIG.newsDisplayMs);
}

setInterval(async () => {
  await loadNews();
}, CONFIG.newsRefreshMs);

setInterval(showNews, CONFIG.newsIntervalMs);

// ---------------- Arranque ----------------

(async function start() {
  await Promise.all([loadPlaylist(), loadNews()]);
  if (playlist.length > 0) playNext();
  else {
    trackTitleEl.textContent = "Sin canciones en /music";
    trackArtistEl.textContent = "Agregá archivos y actualizá playlist.json";
  }
  // Primera noticia recién a los newsIntervalMs, no de arranque,
  // para no tapar la pantalla apenas abre OBS.
})();
