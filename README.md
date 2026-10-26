# 🎮 Ludoteca de la Tusa

Inventario de cartuchos de Nintendo Switch y Switch 2, con estética retro.

- **Añadir juegos con portada**: escribes el título, eliges el juego correcto en una lista con miniaturas (IGDB o Wikipedia) y aparece con su carátula, ficha técnica y categoría.
- **Foto propia**: puedes subir una foto de tu caja desde el móvil.
- **En la nube**: la lista se ve igual desde cualquier dispositivo. Cualquiera con el enlace puede *mirar*; para *editar* hace falta una contraseña.
- **Sin servidor también funciona**: si abres `index.html` directamente, se guarda en el navegador como antes.

## Cómo está montado

```
index.html        la web (todo en un archivo)
api/games.js      leer / guardar juegos       → Upstash Redis
api/search.js     buscador de portadas        → IGDB (clave secreta, solo en el servidor)
api/upload.js     fotos propias               → Vercel Blob
api/auth.js       comprobar la contraseña de edición
api/_lib.js       utilidades compartidas
```

## Puesta en marcha en Vercel (≈15 min, todo gratis)

### 1. Importar el proyecto
1. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → elige `fade1985/ludoteca-tusa` → **Deploy**.
   No hay que tocar nada: *Framework Preset* "Other", sin comando de build.

### 2. Base de datos (obligatorio)
1. En el proyecto: **Storage → Create Database → Upstash (Redis)** → plan gratis → conéctalo al proyecto.
2. Vercel añade solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; sirven las dos).

### 3. Contraseña de edición (obligatorio)
**Settings → Environment Variables** → añade `EDIT_PASSWORD` con la contraseña que quieras.

### 4. Portadas de IGDB (muy recomendable)
IGDB tiene muchas más portadas que Wikipedia, sobre todo de juegos indie, y por plataforma.
1. Tu cuenta de Twitch necesita la verificación en dos pasos activada.
2. Ve a [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → **Register Your Application**:
   - Name: `ludoteca-tusa` (cualquiera)
   - OAuth Redirect URLs: `http://localhost`
   - Category: *Website Integration* · Client Type: *Confidential*
3. Copia el **Client ID** y genera un **Client Secret**.
4. En Vercel añade `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`.

Sin IGDB todo funciona igual, pero buscando solo en Wikipedia.

### 5. Fotos propias (opcional)
**Storage → Create → Blob** (acceso *public*) → conéctalo al proyecto. Añade `BLOB_READ_WRITE_TOKEN`.
Sin Blob, las fotos se guardan más pequeñas dentro de la base de datos.

### 6. Volver a desplegar
Las variables nuevas solo se aplican en despliegues nuevos: **Deployments → ⋯ → Redeploy**.

## Primer uso
1. Abre la web. Verás el aviso *"La nube está vacía"*.
2. Pulsa **SUBIR LISTA** (o ☰ → *Entrar en modo edición*) e introduce la contraseña: se sube la lista inicial y empiezan a cargarse las portadas.
3. **¿Ya tenías marcas y notas en el HTML antiguo?** Ábrelo, ☰ → *Exportar copia (.json)*; luego en la web nueva ☰ → *Importar copia*.

La contraseña se queda guardada en ese navegador; ☰ → *Salir del modo edición* la olvida.

## Corregir una portada
Abre el juego → **Editar / corregir** → aparece la lista de candidatos: elige el bueno o sube una foto.

## Desarrollo local
```bash
npm install
npx vercel link       # una vez
npx vercel env pull   # trae las variables
npx vercel dev        # http://localhost:3000
```
