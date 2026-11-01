# OpenPlaylistTransfer

Transfiere playlists entre **Spotify**, **Tidal**, **YouTube Music** y **Apple Music** directo desde tu navegador.
Gratis, de código abierto y **sin servidores intermedios**: la página habla directamente con la API oficial de cada servicio usando tus propias claves de desarrollador.

[![Apóyame en Ko-fi](https://img.shields.io/badge/Ko--fi-Ap%C3%B3yame-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/carmelitasoftworks)

👉 **Úsala aquí:** https://carmelitasoftworks.github.io/OpenPlaylistTransfer/

## Servicios

| Servicio | Origen | Destino | Cómo se conecta | Notas |
|---|:-:|:-:|---|---|
| Spotify | ✅ | ✅ | OAuth PKCE (solo Client ID) | El dueño de la app necesita Premium; máx. 5 usuarios en modo desarrollo. Solo lee playlists tuyas o colaborativas. |
| Tidal | ✅ | ✅ | OAuth PKCE (solo Client ID) | API oficial v2 (`openapi.tidal.com`). |
| YouTube Music | ✅ | ✅ | OAuth de Google (Client ID web) | Cuota gratuita ≈ 65 canciones/día como destino; la transferencia se puede continuar otro día. |
| Apple Music | ✅ | ✅ | MusicKit JS + developer token | Requiere cuenta Apple Developer (de pago). |
| Texto / CSV | ✅ | ✅ | — | Puente para servicios sin API abierta: Deezer, SoundCloud, Amazon Music, Qobuz… Lee CSV de Exportify, TuneMyMusic, Soundiiz, etc. |

**Por qué no hay Deezer, SoundCloud ni Amazon Music directos:** Deezer no acepta apps nuevas en su API, SoundCloud exige una cuenta Artist Pro para registrar una app y Amazon Music y Qobuz no tienen API pública. Para esos servicios usa la opción Texto / CSV.

## Cómo funciona

1. Eliges el servicio de origen y el de destino.
2. Inicias sesión en los dos con OAuth. Los tokens se guardan solo en tu navegador (`localStorage`).
3. Lee las canciones de la playlist de origen.
4. Busca cada canción en el destino:
   - primero por **ISRC** (coincidencia exacta, en lotes),
   - y si no aparece, por **artista + título**, con una puntuación que compara título normalizado, artista, versión (remix, live, etc.) y duración.
5. Crea la playlist (privada o no listada) y agrega las canciones encontradas en bloques.
6. El progreso se guarda después de cada bloque: si se corta, la cuota se agota o cierras la pestaña, puedes **continuar** donde quedó.
7. Al final puedes copiar o descargar en CSV la lista de canciones no encontradas.

## Configuración (una sola vez)

La **Redirect URI** es la dirección de la página, por ejemplo `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`. La propia app la muestra con un botón para copiarla.

### Spotify
1. https://developer.spotify.com/dashboard → *Create app*.
2. Redirect URI: la de arriba. Marca *Web API*.
3. Copia el *Client ID* en la app. El secret no hace falta.

### Tidal
1. https://developer.tidal.com/dashboard → crea una app.
2. Agrega la Redirect URI.
3. Activa los permisos `user.read`, `playlists.read`, `playlists.write` y `search.read`.
4. Copia el *Client ID*.

### YouTube Music
1. https://console.cloud.google.com/ → crea un proyecto y activa **YouTube Data API v3**.
2. *Pantalla de consentimiento OAuth* → Externo → agrégate como usuario de prueba.
3. *Credenciales* → *ID de cliente OAuth* → **Aplicación web**:
   - Orígenes de JavaScript autorizados: `https://carmelitasoftworks.github.io`
   - URI de redireccionamiento autorizados: la Redirect URI.
4. Copia el *Client ID*.

### Apple Music
1. Con una cuenta de Apple Developer, crea una *Key* con **MusicKit** y descarga el `.p8`.
2. Genera el developer token:
   ```bash
   node docs/apple-developer-token.mjs AuthKey_XXXXXXXXXX.p8 TU_TEAM_ID TU_KEY_ID
   ```
3. Pega el token en la app y conecta. Apple te pedirá iniciar sesión.

## Correr localmente

Es una página estática, sin compilación:

```bash
python3 -m http.server 8000
# abre http://127.0.0.1:8000/  (Spotify acepta 127.0.0.1 como Redirect URI)
```

## Estructura

```
index.html            interfaz
css/style.css
js/core.js            OAuth/PKCE, HTTP con reintentos, coincidencia de canciones, CSV
js/app.js             interfaz y motor de transferencia (con reanudación)
js/providers/*.js     un módulo por servicio (misma interfaz)
docs/apple-developer-token.mjs
```

Para agregar un servicio, crea un módulo en `js/providers/` con `listPlaylists`, `getTracks`, `createPlaylist`, `findMany` y `addTracks`, y regístralo en `js/app.js`.

## Privacidad

No hay backend, analítica ni rastreadores. Todas las peticiones van de tu navegador a las APIs oficiales de cada servicio.

## Apoyo

Si te sirve, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/carmelitasoftworks)** ☕

## Licencia

[GPL-3.0](LICENSE) © Carmelita Softworks
