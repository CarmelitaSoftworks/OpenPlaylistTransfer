# Tutorial: how to use OpenPlaylistTransfer

[Español](TUTORIAL.md) · **English**

This guide walks you through moving a playlist from one service to another (for example, **Spotify to Tidal**), step by step. It works on desktop and mobile.

> **In short:** each service asks you to register a free "developer app". You do this **only once**, and it takes about 5 minutes per service. After that you just tap "Connect" and sign in.

**App page:** https://carmelitasoftworks.github.io/OpenPlaylistTransfer/

> The app interface is currently in Spanish. Button names are given below as **English (Spanish)** so you can follow along.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Set up Spotify](#2-set-up-spotify)
3. [Set up Tidal](#3-set-up-tidal)
4. [Set up YouTube Music](#4-set-up-youtube-music)
5. [Set up Apple Music](#5-set-up-apple-music)
6. [Run the transfer](#6-run-the-transfer)
7. [Text / CSV (Deezer, SoundCloud, Amazon Music…)](#7-text--csv)
8. [Troubleshooting](#8-troubleshooting)
9. [FAQ](#9-faq)

---

## 1. Before you start

You only need to set up **the two services you're going to use**: the source and the destination.

The address you paste into every developer dashboard (the **Redirect URI**) is always:

```
https://carmelitasoftworks.github.io/OpenPlaylistTransfer/
```

⚠️ Copy it **exactly**: with `https://`, the capital letters in `OpenPlaylistTransfer` and the **trailing slash `/`**. If a single character differs, sign-in fails. You can also copy it with the **Copy (Copiar)** button in step 2 of the app.

### What is the "Client ID"?

It's a code that identifies *your* app to Spotify, Tidal, etc. **It isn't a password** and it's fine for others to see it. What you must **never** share or paste anywhere is the **Client Secret**; this app doesn't use it.

---

## 2. Set up Spotify

**Requirement:** the account that creates the developer app needs **Spotify Premium** (a Spotify rule since 2026).

1. Go to **https://developer.spotify.com/dashboard** and sign in with your Spotify account.
2. If it's your first time, accept the developer terms.
3. Tap **Create app** and fill in:
   | Field | What to enter |
   |---|---|
   | App name | Anything, e.g. `My transfer` |
   | App description | Anything, e.g. `Transfer my playlists` |
   | Website | (optional) the app address |
   | **Redirect URIs** | `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/` → tap **Add** |
   | Which API/SDKs… | Check **Web API** only |
4. Check the terms box and tap **Save**.
5. Inside the app, open **Settings** and copy the **Client ID**.
6. In OpenPlaylistTransfer, step 2, paste it into **Spotify Client ID** and tap **Connect (Conectar)**.
7. Spotify asks for permission: tap **Agree**. When you come back you'll see **connected (conectado)** in green.

💡 **Want someone else to use your Spotify app?** In the dashboard, open **User Management** and add their name and Spotify email (5 people max). It's easier for each person to create their own app.

---

## 3. Set up Tidal

1. Go to **https://developer.tidal.com/dashboard** and sign in with your Tidal account.
2. Create a new app (**Create app** / **New app**). Name it whatever you like.
3. In the app settings:
   - **Redirect URIs:** add `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`
   - **Scopes:** enable
     - `user.read`
     - `playlists.read`
     - `playlists.write`
     - `search.read` (if available)
4. Save and copy the **Client ID**.
5. In OpenPlaylistTransfer, paste it into **Tidal Client ID** and tap **Connect (Conectar)**.
6. Sign in to Tidal and accept the permissions.

💡 If your Tidal dashboard **doesn't show** one of those scopes (for example `search.read`), open **Advanced (Avanzado)** in the app's Tidal box and, under **Permissions (Permisos)**, keep only the ones you have, separated by spaces. Example:
```
user.read playlists.read playlists.write
```

---

## 4. Set up YouTube Music

YouTube Music works through Google's YouTube API. It's the longest one to set up, but you only do it once.

1. Go to **https://console.cloud.google.com/** with your Google account.
2. At the top, open the project picker → **New project** → name it → **Create**.
3. Search for **YouTube Data API v3**, open it and tap **Enable**.
4. Go to **APIs & Services → OAuth consent screen** (or **Google Auth Platform**):
   - User type: **External**.
   - Enter an app name and your email.
   - Under **Test users** (Audience), add **your own Google email**.
5. Go to **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** `https://carmelitasoftworks.github.io`
   - **Authorized redirect URIs:** `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`
   - Tap **Create** and copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
6. In OpenPlaylistTransfer, paste it into **Google OAuth Client ID** and tap **Connect (Conectar)**.
7. Google may show "Google hasn't verified this app". That's expected since the app is yours: tap **Continue**.

⚠️ **YouTube limit:** the free quota covers about **65 songs per day** when YouTube Music is the **destination**. When it runs out, the app saves your progress; the next day, tap **Continue (Continuar)**. As a **source** there's no problem. Google sessions last 1 hour; if yours expires, tap **Reconnect (Reconectar)** and then **Continue (Continuar)**.

---

## 5. Set up Apple Music

Apple Music requires an **Apple Developer** account (paid, USD 99/year).

1. At **https://developer.apple.com/account** go to **Certificates, IDs & Profiles → Keys** and create a key with **MusicKit** enabled.
2. Download the `AuthKey_XXXXXXXXXX.p8` file (it can only be downloaded once) and note the **Key ID** and your **Team ID** (shown at the top right of your account).
3. Generate the *developer token* with [Node.js](https://nodejs.org) on your computer:
   ```bash
   node docs/apple-developer-token.mjs AuthKey_XXXXXXXXXX.p8 YOUR_TEAM_ID YOUR_KEY_ID
   ```
   The script is in this repository at `docs/apple-developer-token.mjs`. The token lasts up to 6 months.
4. In OpenPlaylistTransfer, paste the token into **Apple Music developer token** and tap **Connect (Conectar)**. Apple will ask you to sign in with your Apple ID.

---

## 6. Run the transfer

1. **Step 1:** choose **From (Desde)**, the source, and **To (Hacia)**, the destination. The **⇅ Swap (Intercambiar)** button flips them.
2. **Step 2:** check that both services say **connected (conectado)**.
3. **Step 3:** pick the playlist from the list, or paste its link. You can give the new playlist a different name; if you leave it empty, it keeps the same name.
4. Tap **Transfer (Transferir)**.
5. **Step 4:** you'll see the progress and how many songs were found and not found.
   - You can tap **Pause (Pausar)** and pick up later with **Continue (Continuar)**, even if you close the page.
   - When it's done, tap **Open in… (Abrir en…)** to see the new playlist.
   - If songs are missing, tap **Copy not found (Copiar no encontradas)** or **Download CSV (Descargar CSV)** to look them up by hand.

### How does it find the songs?

1. First it searches by **ISRC**, a unique code for each recording. This finds the exact same version.
2. If that fails, it searches by **artist + title**, comparing version (remix, live, etc.) and duration so it doesn't add the wrong song.

It's normal for a few songs to be missing: tracks that aren't in the other service's catalog or in your country, exclusive versions, local files, etc.

---

## 7. Text / CSV

For services without an open API (**Deezer, SoundCloud, Amazon Music, Qobuz**, etc.):

**To bring a playlist in from them:**
1. Export the playlist with a tool that produces CSV (for example TuneMyMusic or Soundiiz), or type or paste the list yourself.
2. Under **From (Desde)**, choose **Texto / CSV**.
3. Paste one song per line in the format `Artist - Title`, or tap **Upload CSV (Subir CSV)**.
4. Choose the destination and tap **Transfer (Transferir)**.

**To send a playlist out to them:**
1. Under **To (Hacia)**, choose **Texto / CSV**.
2. When it finishes, a CSV downloads (artist, title, album, ISRC and duration) that you can import into those services with TuneMyMusic or Soundiiz.

It's also handy for backing up your playlists: Spotify → Text / CSV.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| **The page shows 404** | Open the full address, ending in `/OpenPlaylistTransfer/`. |
| **Spotify: "INVALID_CLIENT: Invalid redirect URI"** | The Redirect URI in the dashboard isn't identical. Check the trailing slash and capital letters. |
| **Spotify: "Please enter a valid redirect URI" when creating the app** | The field was left empty (the grey text is only an example). Type the address and tap **Add** before **Save**. |
| **Spotify: 403 error when reading or creating playlists** | The app owner's account needs Premium, or the account you signed in with isn't in *User Management*. |
| **Spotify: "couldn't open that playlist"** | Spotify only allows reading playlists **you own or collaborate on**. For someone else's playlist, first copy it into one of yours in the Spotify app. |
| **Tidal: "Something went wrong" (code 11102)** | Almost always the Redirect URI or the scopes. Check that the address is identical and that the [Tidal](#3-set-up-tidal) scopes are enabled. If you don't have `search.read`, remove it under **Advanced (Avanzado) → Permissions (Permisos)**. |
| **Google: "Error 400: redirect_uri_mismatch"** | The Redirect URI is missing from *Authorized redirect URIs*. |
| **Google: "Access blocked / app in testing"** | Add your email as a **test user** on the consent screen. |
| **YouTube: "daily quota exceeded"** | That's Google's free limit. Come back the next day and tap **Continue (Continuar)**. |
| **"Session expired"** | Tap **Reconnect (Reconectar)** for that service, then **Continue (Continuar)**. Your progress isn't lost. |
| **My playlist isn't in the list** | Paste the link directly into the "…or paste the link" field. |
| **I used another browser or incognito mode and my keys are gone** | Keys and sessions are saved only in the browser where you entered them. Paste them again. |

---

## 9. FAQ

**Is it safe?**
Yes. The page is static: no server and no analytics. Your browser talks directly to Spotify, Tidal, Google or Apple. Keys and sessions stay on your device only. The full source code is in this repository.

**Why do I have to create a developer app?**
So everyone uses their own keys, doesn't depend on anyone else and doesn't hit the services' user limits. Commercial apps do the same thing, but with their app and their server in the middle.

**Does it delete or change my original playlist?**
No. It only **reads** it and creates a **new** playlist at the destination.

**Is the new playlist public?**
No. It's created as private (Spotify, YouTube) or unlisted (Tidal). You can change that later in the service's app.

**How long does it take?**
A few minutes for playlists with hundreds of songs. With more than 1,000 it can take longer because of each API's limits, but the app waits and retries on its own.

**Can I use it on my phone?**
Yes, from any browser.

---

Found it useful? Support me on **[Ko-fi](https://ko-fi.com/carmelitasoftworks)** ☕
Found a bug? Open an [issue](https://github.com/CarmelitaSoftworks/OpenPlaylistTransfer/issues).
