# Fuente de navegador para OBS — Música 24/7 + Noticias

Página HTML pensada como **Browser Source** de OBS para una transmisión
24/7: reproduce música en aleatorio con el título en pantalla, muestra
noticias con foto + texto + código QR hacia la nota, rota publicidades
(imagen o video mudo) de fondo, y de tanto en tanto un popup invitando
a suscribirse.

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
.github/workflows/update-playlists.yml   corre esos scripts solo al subir archivos (ver mas abajo)
hosting/.htaccess.example      plantilla de usuario/contraseña para hosting público
HOSTING.md               guía de hosting en WordPress y protección de acceso
```

## 0. Subir música/fondos y que se actualice solo (configuración única)

Subir archivos a `music/` o `backgrounds/` (por ejemplo desde la web de
GitHub, con "Add file → Upload files") **actualiza la playlist sola**:
un GitHub Action detecta el cambio, corre los scripts de
`scripts/generate_playlist.py` / `scripts/generate_backgrounds_playlist.py`
y commitea el `playlist.json` actualizado — no hace falta correr nada a
mano ni pedirme que lo haga.

Esto requiere un **paso de configuración único** en el repositorio (ya
lo hizo Claude/alguien con acceso, pero por las dudas):

1. GitHub → **Settings → Actions → General**.
2. Bajar hasta **"Workflow permissions"**.
3. Elegir **"Read and write permissions"** y guardar.

Sin este permiso, el Action no puede commitear el `playlist.json`
actualizado (falla con un error de permisos, visible en la pestaña
**Actions** del repo). Se configura una sola vez.

## 1. Cargar canciones

1. Copiá tus archivos de audio a la carpeta `music/` (mp3, m4a, ogg, wav
   o flac) y subilos al repo (push, o "Add file → Upload files" desde
   la web de GitHub).
2. Nombralos idealmente como `Artista - Título.mp3` para que el
   reproductor detecte artista y título solo. Si no, se usa el nombre
   del archivo entero como título.
3. Listo. El GitHub Action (ver sección 0) regenera `music/playlist.json`
   solo en cuanto detecta el push — no hace falta correr nada a mano.
   La página relee esa lista cada 2 minutos, así que en un par de
   minutos el tema nuevo ya está sonando (sin cortar la canción que
   esté sonando en ese momento, y sin tocar OBS).
4. Si preferís generarlo vos mismo en el momento (por ejemplo, para
   probarlo local antes de subir), corré:
   ```bash
   python3 scripts/generate_playlist.py
   ```
   Es seguro correrlo en cualquier momento: **no pisa** títulos/artistas
   que ya hayas corregido a mano, solo agrega los archivos nuevos y saca
   los que borraste.

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

### No suenan los temas (o no rotan los fondos) — checklist rápido

- ¿Pasaron ya 1-2 minutos desde que subiste los archivos? El Action
  tarda un rato en correr y GitHub Pages otro poco en desplegar.
- Repositorio → pestaña **Actions**: ¿el workflow "Actualizar
  playlists de musica y fondos" corrió bien (✅) o falló (❌)? Si
  falló, seguramente falta el permiso de escritura — ver sección 0.
- Fijate que `music/playlist.json` (o `backgrounds/playlist.json`) no
  haya quedado vacío (`[]`) después de esto.
- ¿Estás probando local, abriendo la página con un servidor
  (`http://localhost:...`) y no como archivo (`file://...`)? Abierta
  como archivo local, el navegador bloquea la lectura de los `.json`.
- Revisá la consola del navegador (F12 → Console): ahí quedan los
  errores si algún archivo no carga.

## 2. Cargar noticias

Editá `news/news.json`. Es una lista: cargá ahí todas las noticias que
quieras tener disponibles y la página las va mostrando **en bloques**,
rotando en orden (y cuando termina la lista, vuelve a arrancar desde
la primera).

Pensada para verse bien en un TV: cuando le toca a un bloque de
noticias, ocupa **toda la pantalla** con un fondo de color plano
(reemplaza momentáneamente el slideshow de publicidades de fondo, que
sigue pausado hasta que termina el bloque) — título grande, foto
grande y un QR grande y legible para escanear desde lejos. La marca,
el reloj y el reproductor de música siguen visibles arriba de todo.

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
- **`link`**: la URL de la noticia completa en el sitio de noticias.
  Se convierte **automáticamente en un código QR** en pantalla (no
  hace falta generar el QR vos). Si una noticia no tiene `link`, se
  muestra sin QR.
  Antes de generar el QR, se le agregan automáticamente parámetros UTM
  para trackear en Analytics/YouTube cuánta gente escanea desde la
  transmisión (`?utm_source=youtube&utm_medium=qrscan&utm_campaign=lasocia`,
  o con `&` si el link ya tenía otros parámetros). Se ajusta en
  `js/app.js` → `CONFIG` → `qrUtmParams`.
- La página relee `news.json` sola cada 3 minutos, así que agregar o
  sacar noticias de la lista se refleja solo (sin reiniciar OBS).
- **Al abrir la página** ya arranca mostrando un bloque de noticias
  (por defecto, las primeras 2 de la lista) antes de empezar el
  slideshow de fondos.
- Después, **cada 15 minutos** se dispara otro bloque de 2 noticias
  (retomando la rotación donde quedó la vez anterior), pausando el
  slideshow de fondos mientras dura y retomándolo solo al terminar.
  Cada noticia del bloque queda **30 segundos** en pantalla.
- Todo esto se ajusta en `js/app.js` → `CONFIG`: `newsIntervalMs`
  (cada cuánto se dispara un bloque), `newsItemsPerBlock` (cuántas
  noticias seguidas por bloque) y `newsDisplayMs` (cuánto dura cada
  una en pantalla).
- El color de fondo plano de la pantalla de noticias se ajusta en
  `css/style.css` → `:root` → `--news-flat-bg`.

## 3. Cargar publicidades de fondo

Copiá las imágenes y/o videos a la carpeta `backgrounds/` y subilos al
repo. Igual que con la música, el GitHub Action (sección 0) regenera
`backgrounds/playlist.json` solo — no hace falta correr nada a mano.
Si querés generarlo vos en el momento (ej. para probar local), corré:

```bash
python3 scripts/generate_backgrounds_playlist.py
```

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

## 4. Popup de suscripción

Un banner desciende desde arriba al centro de la pantalla invitando a
suscribirse, y vuelve a subir solo. Por ahora es solo texto (sin
link/QR — se puede agregar el día que haya un canal/link definido).

- Aparece **al minuto** de abrir la página, y después **cada 10
  minutos**.
- Queda visible **15 segundos** cada vez.
- Si coincide con un bloque de noticias (pantalla completa), se salta
  esa aparición para no superponerse — vuelve a aparecer en el
  siguiente turno, 10 minutos después.
- Texto, tiempos y color se ajustan en:
  - `index.html` → `#subscribePopup` (el texto)
  - `js/app.js` → `CONFIG` → `subscribeFirstDelayMs`,
    `subscribeIntervalMs`, `subscribeDisplayMs`
  - `css/style.css` → `.subscribe-popup` (usa el gradiente de acento
    de la marca por defecto)

## 5. Probarlo / correrlo

Los `fetch()` a los `.json` necesitan que la página se sirva por HTTP,
no abierta como archivo local (`file://`). Desde la carpeta del
proyecto:

```bash
python3 -m http.server 8080
```

Y abrís `http://localhost:8080/index.html` en el navegador para
probarlo antes de meterlo en OBS.

## 6. Publicarlo en GitHub Pages

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

## 7. Agregarlo en OBS

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

## 8. Más adelante: hosting propio (ej. WordPress)

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
| `newsIntervalMs` | cada cuánto se dispara un bloque de noticias |
| `newsItemsPerBlock` | cuántas noticias seguidas se muestran por bloque |
| `newsDisplayMs` | cuánto tiempo queda visible cada noticia dentro del bloque |
| `qrSize` | tamaño en px del QR generado |
| `backgroundsRefreshMs` | cada cuánto relee la carpeta `backgrounds/` |
| `backgroundImageDurationMs` | cuánto queda cada imagen de fondo antes de pasar a la siguiente |

## Ideas para seguir sumando

- Historial de "últimas canciones" en pantalla.
- Pedidos de canciones vía chat de Twitch/YouTube.
- Franja de texto (ticker) con más noticias corriendo abajo.
- Distintos "temas" visuales (día/noche, fechas especiales).
