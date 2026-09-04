# Laura Ubfal Live — Fuente de navegador para OBS

Página HTML pensada como **Browser Source** de OBS para una transmisión
24/7: reproduce música en aleatorio con el título en pantalla, muestra
noticias con foto + texto + código QR hacia la nota, y rota publicidades
(imagen o video mudo) de fondo.

## Estructura

```
index.html            página principal (la que se carga en OBS)
css/style.css          estilos
js/app.js               lógica: playlist, reproductor, noticias, fondos, QR
music/                 poné acá tus archivos de audio (mp3, m4a, ogg, wav, flac)
music/playlist.json     lista de canciones (se autogenera con el script)
news/news.json          lista de noticias a mostrar
news/images/            imágenes locales de noticias (opcional)
backgrounds/            poné acá las publicidades: imagen o video mudo
backgrounds/playlist.json   lista de fondos (se autogenera con el script)
scripts/generate_playlist.py             escanea /music y actualiza playlist.json
scripts/generate_backgrounds_playlist.py escanea /backgrounds y actualiza su playlist.json
hosting/.htaccess.example      plantilla de usuario/contraseña para hosting público
HOSTING.md               guía de hosting en WordPress y protección de acceso
```

## 1. Cargar canciones

Esta página está pensada hoy para **GitHub Pages** (hosting estático:
no ejecuta PHP ni permite listar carpetas), así que el flujo es:

**Paso obligatorio cada vez que agregás o sacás archivos de `music/`:**

1. Copiá tus archivos de audio a la carpeta `music/` (mp3, m4a, ogg, wav
   o flac).
2. Corré:
   ```bash
   python3 scripts/generate_playlist.py
   ```
   Esto actualiza `music/playlist.json`, que es la lista que la página
   realmente reproduce. **Si no corrés este paso, los mp3 nuevos no
   suenan** (van a estar en la carpeta pero la página no los va a
   conocer).
3. Nombralos idealmente como `Artista - Título.mp3` para que el
   reproductor detecte artista y título solo. Si no, se usa el nombre
   del archivo entero como título.
4. Commiteá y pusheá — GitHub Pages se actualiza solo con cada push.
5. La página relee `playlist.json` sola cada 2 minutos, así que no hace
   falta tocar OBS ni reiniciar nada para que los temas nuevos empiecen
   a sonar (la canción que está sonando en ese momento no se corta).
6. Volver a correr el script es seguro en cualquier momento: **no pisa**
   títulos/artistas que ya hayas corregido a mano, solo agrega los
   archivos nuevos y saca los que borraste.

> **Sobre `music/playlist.php`**: existe en el repo un endpoint PHP que
> escanea `/music` solo, en tiempo real, sin necesitar el paso 2 — pero
> **solo funciona en un hosting con PHP** (como el de WordPress), no en
> GitHub Pages. Por ahora queda ahí sin usarse (en GitHub Pages se
> ignora solo, no rompe nada) para cuando llegue el momento de migrar a
> ese hosting. Más detalle en [`HOSTING.md`](HOSTING.md).

### Corregir título/artista manualmente

Muchos bancos de música libre nombran los archivos al revés ("Título -
Artista" en vez de "Artista - Título"), y el script no tiene forma de
adivinar eso. Si ves un tema con el título/artista cambiado, editá
directamente su entrada en `music/playlist.json`:

```json
{ "file": "cancion1.mp3", "title": "Mi Título", "artist": "Mi Artista" }
```

Esa corrección queda guardada aunque vuelvas a correr el script.

### No suenan los temas — checklist rápido

- ¿Corriste `python3 scripts/generate_playlist.py` después de agregar
  los mp3? Fijate que `music/playlist.json` no esté vacío (`[]`).
- ¿Estás abriendo la página con un servidor (`http://localhost:...`) y
  no como archivo (`file://...`)? Abierta como archivo local, el
  navegador bloquea la lectura de `playlist.json` y `news.json`.
- Revisá la consola del navegador (F12 → Console): ahí quedan los
  errores si algún archivo no carga.

## 2. Cargar noticias

Editá `news/news.json`. Es una lista: cargá ahí todas las noticias que
quieras tener disponibles y la página las va mostrando **una por vez,
rotando en orden** — cada `newsIntervalMs` aparece la siguiente de la
lista (y cuando termina, vuelve a arrancar desde la primera).

```json
[
  {
    "image": "images/nota1.jpg",
    "text": "Texto o titular de la noticia que se muestra en pantalla.",
    "link": "https://ejemplo.com/nota-completa"
  },
  {
    "image": "images/nota2.jpg",
    "text": "Otra noticia. Podés cargar tantas como quieras, se van turnando solas.",
    "link": "https://ejemplo.com/otra-nota"
  }
]
```

- **`image`**: una foto por noticia. Puede ser una ruta local (guardá
  el archivo en `news/images/` y referencialo como
  `images/nombre.jpg`) o una URL completa (`https://...`). Si el link
  se rompe o la imagen no carga, la página lo detecta sola y oculta
  el espacio de la foto en vez de mostrar un ícono roto.
- **`text`**: el titular/texto corto que se muestra. Si es muy largo,
  se corta con puntos suspensivos a partir de la 5ª línea — mejor
  mantenerlo breve (1-2 oraciones).
- **`link`**: la URL de la noticia completa en la web de Laura Ubfal.
  Se convierte **automáticamente en un código QR** en pantalla (no
  hace falta generar el QR vos). Si una noticia no tiene `link`, se
  muestra sin QR.
- La página relee `news.json` sola cada 3 minutos, así que agregar o
  sacar noticias de la lista se refleja solo (sin reiniciar OBS).
- Por defecto: una noticia aparece **cada 10 minutos** y queda visible
  **30 segundos**. Se puede ajustar en `js/app.js` → `CONFIG`:
  `newsIntervalMs` (frecuencia) y `newsDisplayMs` (duración en
  pantalla).

## 3. Cargar publicidades de fondo

Copiá las imágenes y/o videos a la carpeta `backgrounds/` y corré:

```bash
python3 scripts/generate_backgrounds_playlist.py
```

Igual que con la música, esto es **obligatorio** cada vez que agregás o
sacás archivos de esa carpeta — si no lo corrés, los archivos nuevos no
van a rotar.

- Formatos de imagen válidos: `jpg`, `jpeg`, `png`, `webp`, `gif`.
- Formatos de video válidos: `mp4`, `webm`, `mov`, `m4v`. Los videos se
  reproducen **sin sonido** (aunque tengan audio, se silencia) y de
  fondo, ocupando toda la pantalla, con un velo oscuro encima para que
  el título de la canción y las noticias se sigan leyendo bien.
- Van rotando solas, en orden aleatorio (sin repetir la anterior):
  cada **imagen** queda 35 segundos y pasa a la siguiente; cada
  **video** se reproduce completo y recién ahí pasa al siguiente.
- La página relee la carpeta cada 2 minutos, así que agregar o sacar
  archivos se refleja solo, sin cortar el fondo que esté mostrando en
  ese momento.
- Si la carpeta está vacía, se ve el fondo degradado original (el de
  antes de esta función) — no hace falta tener archivos cargados para
  que la página funcione.
- El tiempo que queda cada imagen se ajusta en `js/app.js` → `CONFIG` →
  `backgroundImageDurationMs`.

## 4. Probarlo / correrlo

Los `fetch()` a los `.json` necesitan que la página se sirva por HTTP,
no abierta como archivo local (`file://`). Desde la carpeta del
proyecto:

```bash
python3 -m http.server 8080
```

Y abrís `http://localhost:8080/index.html` en el navegador para
probarlo antes de meterlo en OBS.

## 5. Publicarlo en GitHub Pages

Esta es la forma en la que estamos usando el proyecto por ahora, así
no depende de tener un servidor corriendo en la PC de streaming:

1. En GitHub, andá a **Settings → Pages** del repositorio.
2. En "Build and deployment" → **Source**, elegí **Deploy from a
   branch**.
3. Elegí la rama con el código (esta rama, o `main` si mergeaste ahí)
   y carpeta `/ (root)`.
4. Guardá. GitHub te va a dar una URL tipo
   `https://tu-usuario.github.io/laulive/`.
5. Cada vez que hagas `git push` con cambios (temas nuevos, noticias,
   etc.), GitHub Pages se actualiza solo en un par de minutos.

Esa URL queda **pública** (cualquiera con el link puede abrirla) — a
diferencia de correrla local, donde solo vos podés acceder. Como el
contenido no es sensible (overlay de música y noticias, sin datos
privados), no debería ser un problema, pero tenelo presente. GitHub
Pages no soporta usuario/contraseña (Basic Auth) por su cuenta; si más
adelante eso importa, es otro argumento a favor de migrar a un hosting
propio como se explica en `HOSTING.md`.

## 6. Agregarlo en OBS

1. En OBS: **Fuentes → Agregar → Fuente de navegador**.
2. URL: la de GitHub Pages (`https://tu-usuario.github.io/laulive/`) o,
   si preferís correrlo local, `http://localhost:8080/index.html` con
   `python3 -m http.server 8080` corriendo.
3. Ancho/alto: `1920x1080` (o el tamaño de tu escena).
4. Marcá **"Controlar audio a través de OBS"** para poder mezclar el
   volumen de la música con el mixer de OBS.
5. Si el audio no arranca solo (política de autoplay), tildá también
   la opción de OBS que permite reproducción de medios sin interacción,
   o simplemente refrescá la fuente una vez al agregarla.

## 7. Más adelante: hosting propio (ej. WordPress)

Cuando llegue el momento de migrar a un hosting propio (por ejemplo,
una carpeta dentro del hosting de WordPress), ver
**[`HOSTING.md`](HOSTING.md)**: ahí está la guía de protección con
usuario/contraseña (Basic Auth) y el detalle de `music/playlist.php`,
que en ese tipo de hosting permite detectar mp3s nuevos sin correr
ningún script.

## Personalización rápida (`js/app.js` → `CONFIG`)

| Parámetro | Qué hace |
|---|---|
| `playlistRefreshMs` | cada cuánto relee `playlist.json` |
| `newsRefreshMs` | cada cuánto relee `news.json` |
| `newsIntervalMs` | cada cuánto aparece una noticia en pantalla |
| `newsDisplayMs` | cuánto tiempo queda visible cada noticia |
| `qrSize` | tamaño en px del QR generado |
| `backgroundsRefreshMs` | cada cuánto relee la carpeta `backgrounds/` |
| `backgroundImageDurationMs` | cuánto queda cada imagen de fondo antes de pasar a la siguiente |

## Ideas para seguir sumando

- Historial de "últimas canciones" en pantalla.
- Pedidos de canciones vía chat de Twitch/YouTube.
- Franja de texto (ticker) con más noticias corriendo abajo.
- Distintos "temas" visuales (día/noche, fechas especiales).
