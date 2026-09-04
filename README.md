# Laura Ubfal Live — Fuente de navegador para OBS

Página HTML pensada como **Browser Source** de OBS para una transmisión
24/7: reproduce música en aleatorio con el título en pantalla, y muestra
noticias con foto + texto + código QR hacia la nota.

## Estructura

```
index.html            página principal (la que se carga en OBS)
css/style.css          estilos
js/app.js               lógica: playlist, reproductor, noticias, QR
music/                 poné acá tus archivos de audio (mp3, m4a, ogg, wav, flac)
music/playlist.json     lista de canciones (se autogenera con el script)
news/news.json          lista de noticias a mostrar
news/images/            imágenes locales de noticias (opcional)
scripts/generate_playlist.py   escanea /music y regenera playlist.json
```

## 1. Cargar canciones

1. Copiá tus archivos de audio a la carpeta `music/`.
2. Nombralos idealmente como `Artista - Título.mp3` para que el
   reproductor detecte artista y título solo. Si no, se usa el nombre
   del archivo como título.
3. Corré:
   ```bash
   python3 scripts/generate_playlist.py
   ```
   Esto regenera `music/playlist.json` con todas las canciones
   encontradas. Repetilo cada vez que agregues o saques temas.
4. La página relee `playlist.json` sola cada 5 minutos, así que no hace
   falta reiniciar la fuente en OBS para que aparezcan temas nuevos
   (los ya sonando no se cortan).

También podés editar `music/playlist.json` a mano si querés forzar un
título/artista distinto al del nombre de archivo:

```json
[
  { "file": "cancion1.mp3", "title": "Mi Título", "artist": "Mi Artista" }
]
```

## 2. Cargar noticias

Editá `news/news.json`. Es una lista, podés tener varias noticias y se
van mostrando una por una, rotando:

```json
[
  {
    "image": "images/nota1.jpg",
    "text": "Texto o titular de la noticia que se muestra en pantalla.",
    "link": "https://ejemplo.com/nota-completa"
  }
]
```

- `image` puede ser una ruta local (guardá el archivo en
  `news/images/`) o una URL completa (`https://...`).
- `link` es la URL de la noticia completa: se convierte
  **automáticamente** en un código QR en pantalla (no hace falta generar
  el QR vos, se genera solo).
- La página relee `news.json` cada 3 minutos.
- Podés ajustar cada cuánto aparece una noticia y cuánto tiempo queda
  visible editando `CONFIG.newsIntervalMs` y `CONFIG.newsDisplayMs` en
  `js/app.js`.

## 3. Probarlo / correrlo

Los `fetch()` a los `.json` necesitan que la página se sirva por HTTP,
no abierta como archivo local (`file://`). Desde la carpeta del
proyecto:

```bash
python3 -m http.server 8080
```

Y abrís `http://localhost:8080/index.html` en el navegador para
probarlo antes de meterlo en OBS.

## 4. Agregarlo en OBS

1. Dejá corriendo el servidor local (`python3 -m http.server 8080`),
   idealmente como tarea que arranque con la PC de streaming.
2. En OBS: **Fuentes → Agregar → Fuente de navegador**.
3. URL: `http://localhost:8080/index.html`
4. Ancho/alto: `1920x1080` (o el tamaño de tu escena).
5. Marcá **"Controlar audio a través de OBS"** para poder mezclar el
   volumen de la música con el mixer de OBS.
6. Si el audio no arranca solo (política de autoplay), tildá también
   la opción de OBS que permite reproducción de medios sin interacción,
   o simplemente refrescá la fuente una vez al agregarla.

## Personalización rápida (`js/app.js` → `CONFIG`)

| Parámetro | Qué hace |
|---|---|
| `playlistRefreshMs` | cada cuánto relee `playlist.json` |
| `newsRefreshMs` | cada cuánto relee `news.json` |
| `newsIntervalMs` | cada cuánto aparece una noticia en pantalla |
| `newsDisplayMs` | cuánto tiempo queda visible cada noticia |
| `qrSize` | tamaño en px del QR generado |

## Ideas para seguir sumando

- Historial de "últimas canciones" en pantalla.
- Pedidos de canciones vía chat de Twitch/YouTube.
- Franja de texto (ticker) con más noticias corriendo abajo.
- Distintos "temas" visuales (día/noche, fechas especiales).
