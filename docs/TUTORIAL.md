# Tutorial: cómo usar OpenPlaylistTransfer

**Español** · [English](TUTORIAL.en.md)

Esta guía explica, paso a paso, cómo pasar una playlist de un servicio a otro (por ejemplo, de **Spotify a Tidal**). Funciona desde el computador o el celular.

> **Resumen:** cada servicio pide que registres una "app de desarrollador" gratis. Solo se hace **una vez** y toma unos 5 minutos por servicio. Después solo tocas "Conectar" e inicias sesión.

**Página de la app:** https://carmelitasoftworks.github.io/OpenPlaylistTransfer/

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Configurar Spotify](#2-configurar-spotify)
3. [Configurar Tidal](#3-configurar-tidal)
4. [Configurar YouTube Music](#4-configurar-youtube-music)
5. [Configurar Apple Music](#5-configurar-apple-music)
6. [Hacer la transferencia](#6-hacer-la-transferencia)
7. [Usar Texto / CSV (Deezer, SoundCloud, Amazon Music…)](#7-usar-texto--csv)
8. [Problemas frecuentes](#8-problemas-frecuentes)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Antes de empezar

Solo necesitas configurar **los dos servicios que vas a usar**: el de origen y el de destino.

La dirección que vas a pegar en cada panel de desarrollador (la **Redirect URI**) es siempre esta:

```
https://carmelitasoftworks.github.io/OpenPlaylistTransfer/
```

⚠️ Cópiala **exactamente igual**: con `https://`, con las mayúsculas de `OpenPlaylistTransfer` y con la **barra `/` al final**. Si cambia un solo carácter, el inicio de sesión falla. También la puedes copiar con el botón **Copiar** que hay en la app, en el paso 2.

### ¿Qué es el "Client ID"?

Es un código que identifica *tu* app ante Spotify, Tidal, etc. **No es una contraseña** y se puede ver sin problema. Lo que **nunca** debes compartir ni pegar en ningún lado es el **Client Secret**; esta app no lo usa.

---

## 2. Configurar Spotify

**Requisito:** la cuenta con la que creas la app de desarrollador necesita **Spotify Premium** (regla de Spotify desde 2026).

1. Entra a **https://developer.spotify.com/dashboard** e inicia sesión con tu cuenta de Spotify.
2. Si es la primera vez, acepta los términos de desarrollador.
3. Toca **Create app** y llena:
   | Campo | Qué poner |
   |---|---|
   | App name | Lo que quieras, ej. `Mi transferencia` |
   | App description | Lo que quieras, ej. `Transferir mis playlists` |
   | Website | (opcional) la dirección de la app |
   | **Redirect URIs** | `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/` → toca **Add** |
   | Which API/SDKs… | Marca solo **Web API** |
4. Marca la casilla de los términos y toca **Save**.
5. Dentro de la app, entra a **Settings** y copia el **Client ID**.
6. En OpenPlaylistTransfer, paso 2, pégalo en **Spotify Client ID** y toca **Conectar**.
7. Spotify te pedirá permiso: toca **Aceptar**. Al volver, verás **conectado** en verde.

💡 **¿Otra persona quiere usar tu app de Spotify?** En el panel, entra a **User Management** y agrega su nombre y su correo de Spotify (máximo 5 personas). Lo más fácil es que cada uno cree la suya.

---

## 3. Configurar Tidal

1. Entra a **https://developer.tidal.com/dashboard** e inicia sesión con tu cuenta de Tidal.
2. Crea una app nueva (**Create app** o **New app**). Ponle el nombre que quieras.
3. En la configuración de la app:
   - **Redirect URIs:** agrega `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`
   - **Scopes (permisos):** activa
     - `user.read`
     - `playlists.read`
     - `playlists.write`
     - `search.read` (si aparece)
4. Guarda los cambios y copia el **Client ID**.
5. En OpenPlaylistTransfer, pégalo en **Tidal Client ID** y toca **Conectar**.
6. Inicia sesión en Tidal y acepta los permisos.

💡 Si tu panel de Tidal **no muestra** alguno de esos permisos (por ejemplo `search.read`), abre **Avanzado** en el recuadro de Tidal de la app y deja en **Permisos** solo los que sí tienes, separados por espacios. Ejemplo:
```
user.read playlists.read playlists.write
```

---

## 4. Configurar YouTube Music

YouTube Music usa la API de YouTube de Google. Es el más largo de configurar, pero solo se hace una vez.

1. Entra a **https://console.cloud.google.com/** con tu cuenta de Google.
2. Arriba, toca el selector de proyecto → **Proyecto nuevo** → ponle un nombre → **Crear**.
3. En el buscador de arriba escribe **YouTube Data API v3**, ábrela y toca **Habilitar**.
4. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth** (o **Google Auth Platform**):
   - Tipo de usuario: **Externo**.
   - Pon un nombre de app y tu correo.
   - En **Usuarios de prueba** (Audiencia), agrega **tu propio correo de Google**.
5. Ve a **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados:** `https://carmelitasoftworks.github.io`
   - **URI de redireccionamiento autorizados:** `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`
   - Toca **Crear** y copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).
6. En OpenPlaylistTransfer, pégalo en **Google OAuth Client ID** y toca **Conectar**.
7. Google puede mostrar "Google no verificó esta app". Es normal porque la app es tuya: toca **Continuar**.

⚠️ **Límite de YouTube:** la cuota gratis alcanza para unas **65 canciones por día** cuando YouTube Music es el **destino**. Si se agota, la app guarda el progreso y al día siguiente tocas **Continuar**. Como **origen** no hay problema. La sesión de Google dura 1 hora; si expira, toca **Reconectar** y luego **Continuar**.

---

## 5. Configurar Apple Music

Apple Music exige una cuenta de **Apple Developer** (de pago, USD 99 al año).

1. En **https://developer.apple.com/account** ve a **Certificates, IDs & Profiles → Keys** y crea una clave con **MusicKit** activado.
2. Descarga el archivo `AuthKey_XXXXXXXXXX.p8` (solo se puede descargar una vez) y anota el **Key ID** y tu **Team ID** (aparece arriba a la derecha en tu cuenta).
3. Genera el *developer token* con [Node.js](https://nodejs.org) en tu computador:
   ```bash
   node docs/apple-developer-token.mjs AuthKey_XXXXXXXXXX.p8 TU_TEAM_ID TU_KEY_ID
   ```
   El script está en este repositorio, en `docs/apple-developer-token.mjs`. El token dura hasta 6 meses.
4. En OpenPlaylistTransfer, pega el token en **Apple Music developer token** y toca **Conectar**. Apple te pedirá iniciar sesión con tu Apple ID.

---

## 6. Hacer la transferencia

1. **Paso 1:** elige **Desde** (origen) y **Hacia** (destino). El botón **⇅ Intercambiar** los da vuelta.
2. **Paso 2:** revisa que ambos servicios digan **conectado**.
3. **Paso 3:** elige la playlist de la lista, o pega su link. Puedes ponerle otro nombre a la nueva playlist; si lo dejas vacío, usa el mismo nombre.
4. Toca **Transferir**.
5. **Paso 4:** verás el avance, cuántas canciones encontró y cuántas no.
   - Puedes tocar **Pausar** y seguir después con **Continuar**, incluso si cierras la página.
   - Al terminar, toca **Abrir en…** para ver la playlist nueva.
   - Si faltaron canciones, toca **Copiar no encontradas** o **Descargar CSV** para buscarlas a mano.

### ¿Cómo encuentra las canciones?

1. Primero busca por **ISRC**, un código único que identifica cada grabación. Así encuentra exactamente la misma versión.
2. Si no la encuentra, busca por **artista + título** y compara versión (remix, live, etc.) y duración para no agregar una canción equivocada.

Es normal que falten algunas: canciones que no están en el catálogo del otro servicio o en tu país, versiones exclusivas, archivos locales, etc.

---

## 7. Usar Texto / CSV

Para servicios sin API abierta (**Deezer, SoundCloud, Amazon Music, Qobuz**, etc.):

**Para traer una playlist desde ellos:**
1. Exporta la playlist con alguna herramienta que genere CSV (por ejemplo TuneMyMusic o Soundiiz), o escribe/pega la lista a mano.
2. En **Desde**, elige **Texto / CSV**.
3. Pega una canción por línea con el formato `Artista - Título`, o toca **Subir CSV**.
4. Elige el destino y toca **Transferir**.

**Para sacar una playlist hacia ellos:**
1. En **Hacia**, elige **Texto / CSV**.
2. Al terminar se descarga un CSV (artista, título, álbum, ISRC y duración) que puedes importar en esos servicios con TuneMyMusic o Soundiiz.

También sirve para respaldar tus playlists: Spotify → Texto / CSV.

---

## 8. Problemas frecuentes

| Problema | Solución |
|---|---|
| **La página da 404** | Abre la dirección completa, terminada en `/OpenPlaylistTransfer/`. |
| **Spotify: "INVALID_CLIENT: Invalid redirect URI"** | La Redirect URI del panel no es idéntica. Revisa la barra final y las mayúsculas. |
| **Spotify: "Please enter a valid redirect URI" al crear la app** | El campo quedó vacío (el texto gris es solo un ejemplo). Escribe la dirección y toca **Add** antes de **Save**. |
| **Spotify: error 403 al leer o crear playlists** | La cuenta dueña de la app necesita Premium, o la cuenta con la que entraste no está en *User Management*. |
| **Spotify: "no pude abrir esa playlist"** | Spotify solo deja leer playlists **tuyas o colaborativas**. Para una de otra persona, primero cópiala a una playlist tuya en la app de Spotify. |
| **Tidal: "Algo salió mal" (código 11102)** | Casi siempre es la Redirect URI o los permisos. Revisa que la dirección sea idéntica y que los permisos de [Tidal](#3-configurar-tidal) estén activados. Si no tienes `search.read`, quítalo en **Avanzado → Permisos**. |
| **Google: "Error 400: redirect_uri_mismatch"** | Falta la Redirect URI en *URI de redireccionamiento autorizados*. |
| **Google: "Acceso bloqueado / app en prueba"** | Agrega tu correo como **usuario de prueba** en la pantalla de consentimiento. |
| **YouTube: "se agotó la cuota diaria"** | Es el límite gratis de Google. Vuelve al día siguiente y toca **Continuar**. |
| **"La sesión expiró"** | Toca **Reconectar** en ese servicio y luego **Continuar**. No se pierde el avance. |
| **No aparece mi playlist en la lista** | Pega el link directamente en "…o pega el link". |
| **Usé otro navegador o el modo incógnito y no aparecen mis claves** | Las claves y sesiones se guardan solo en el navegador donde las pusiste. Vuelve a pegarlas. |

---

## 9. Preguntas frecuentes

**¿Es seguro?**
Sí. La página es estática: no tiene servidor ni analítica. Tu navegador habla directo con Spotify, Tidal, Google o Apple. Las claves y sesiones quedan solo en tu dispositivo. El código está completo en este repositorio.

**¿Por qué tengo que crear una app de desarrollador?**
Porque así cada persona usa sus propias claves, no depende de nadie y no choca con los límites de usuarios que ponen los servicios. Las apps comerciales hacen lo mismo, pero con su app y su servidor de por medio.

**¿Borra o cambia mi playlist original?**
No. Solo la **lee** y crea una playlist **nueva** en el destino.

**¿La playlist nueva queda pública?**
No. Se crea como privada (Spotify, YouTube) o no listada (Tidal). Puedes cambiarlo después en la app del servicio.

**¿Cuánto se demora?**
Unos minutos para playlists de cientos de canciones. Con más de 1.000 puede tardar más por los límites de cada API, pero la app espera y reintenta sola.

**¿Puedo usarla desde el celular?**
Sí, desde cualquier navegador.

---

¿Te sirvió? Apóyame en **[Ko-fi](https://ko-fi.com/carmelitasoftworks)** ☕
¿Encontraste un error? Abre un [issue](https://github.com/CarmelitaSoftworks/OpenPlaylistTransfer/issues).
