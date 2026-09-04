# Hosting en WordPress y protección de acceso

Este documento junta lo que charlamos sobre subir el proyecto a un
hosting de WordPress (en una carpeta propia, fuera del sitio de
WordPress en sí) y cómo protegerlo con usuario/contraseña.

## El repo público vs. la página corriendo

Son dos cosas distintas:

- **El repositorio de GitHub siendo público** solo expone el código
  fuente (HTML/CSS/JS) y los archivos que subas (mp3, imágenes). No
  expone la página "en funcionamiento" en ningún lado por sí solo.
- **La página corriendo** es otra cosa: hoy, si la probás local con
  `python3 -m http.server`, solo es accesible desde tu propia PC/red.
  El día que subas la carpeta a un hosting con URL pública (como el
  de WordPress), ahí sí cualquiera con esa URL podría abrirla.

## Plan: carpeta propia dentro del hosting de WordPress

Idea: subir todo este repo a una carpeta tipo
`tudominio.com/laulive/` (fuera de `wp-content`, para no mezclarlo
con WordPress) y apuntar la fuente de navegador de OBS a esa URL.

Cosas a tener en cuenta con ese plan:

1. **El auto-escaneo de `/music` probablemente no funcione.** La
   mayoría de los hostings (incluidos los de WordPress, por Apache)
   tienen el listado de directorios deshabilitado por seguridad. Por
   eso `playlist.json` (generado con `scripts/generate_playlist.py`)
   es ahora la fuente principal de la playlist — funciona en
   cualquier hosting, no depende de listar la carpeta. Ver
   `README.md` para el flujo de trabajo.
2. **Protegé la carpeta con usuario y contraseña real (Basic Auth).**
   Es la forma correcta de que no cualquiera con la URL entre.

## Cómo proteger la carpeta con Basic Auth (Apache / cPanel)

### Opción A — Desde cPanel (más fácil, sin tocar archivos)

1. cPanel → **Privacidad de directorios** (Directory Privacy).
2. Navegá hasta la carpeta (ej. `laulive/`).
3. Activá "Proteger este directorio" y ponele un nombre.
4. Creá un usuario y contraseña para esa carpeta.

cPanel genera el `.htaccess` y `.htpasswd` solo.

### Opción B — A mano (`.htaccess` + `.htpasswd`)

En este repo dejé una plantilla en `hosting/.htaccess.example`. Para
usarla:

1. Generá la contraseña encriptada (necesitás `openssl`, viene en
   casi cualquier Mac/Linux; en Windows se puede generar con Git
   Bash o pedirle a tu hosting que lo haga por vos):

   ```bash
   openssl passwd -apr1 "tu-contraseña-elegida"
   ```

   Te va a tirar algo como `$apr1$xyz123$abcdefghijklmnopqrstuv`.

2. Creá un archivo `.htpasswd` **fuera de la carpeta pública del
   sitio** (por seguridad, muchos hostings lo ponen un nivel arriba
   del `public_html`) con una línea:

   ```
   usuario:$apr1$xyz123$abcdefghijklmnopqrstuv
   ```

3. Copiá `hosting/.htaccess.example` como `.htaccess` dentro de la
   carpeta `laulive/` del hosting, y editá la ruta
   `AuthUserFile` para que apunte al `.htpasswd` que creaste.

4. Listo: al entrar a `tudominio.com/laulive/` el navegador va a
   pedir usuario y contraseña.

### Usarlo en OBS

En el campo URL de la fuente de navegador, metés las credenciales
directo en la URL así OBS no te pide nada cada vez:

```
http://usuario:contraseña@tudominio.com/laulive/index.html
```

(Reemplazá `usuario` y `contraseña` por los que hayas creado.)

## Alternativa liviana (sin Basic Auth)

Si no querés lidiar con `.htaccess`, la otra opción es simplemente:

- No enlazar la carpeta desde ningún lado del sitio de WordPress.
- Agregar un `robots.txt` que la excluya de buscadores.
- Confiar en que nadie va a adivinar la URL exacta.

Esto **no es seguridad real** (cualquiera con la URL entra), pero
como el contenido no es sensible (es un overlay de música y
noticias, no datos privados), puede alcanzar si no te preocupa que
alguien puntual la vea. La Opción A/B de arriba es la recomendada si
querés estar tranquilo.
