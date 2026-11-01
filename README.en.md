# OpenPlaylistTransfer

[Español](README.md) · **English**

> 📖 **First time? Read the [step-by-step tutorial](docs/TUTORIAL.en.md).**

Transfer playlists between **Spotify**, **Tidal**, **YouTube Music** and **Apple Music** right from your browser.
Free, open source and **no middleman servers**: the page talks directly to each service's official API using your own developer keys.

[![Support me on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/carmelitasoftworks)

👉 **Use it here:** https://carmelitasoftworks.github.io/OpenPlaylistTransfer/ (interface in Spanish)

## Services

| Service | Source | Destination | How it connects | Notes |
|---|:-:|:-:|---|---|
| Spotify | ✅ | ✅ | OAuth PKCE (Client ID only) | The app owner needs Premium; max. 5 users in development mode. Can only read playlists you own or collaborate on. |
| Tidal | ✅ | ✅ | OAuth PKCE (Client ID only) | Official API v2 (`openapi.tidal.com`). |
| YouTube Music | ✅ | ✅ | Google OAuth (web Client ID) | Free quota ≈ 65 songs/day as destination; you can resume the transfer on another day. |
| Apple Music | ✅ | ✅ | MusicKit JS + developer token | Requires an Apple Developer account (paid). |
| Text / CSV | ✅ | ✅ | — | Bridge for services without an open API: Deezer, SoundCloud, Amazon Music, Qobuz… Reads CSVs from Exportify, TuneMyMusic, Soundiiz, etc. |

**Why no direct Deezer, SoundCloud or Amazon Music:** Deezer doesn't accept new apps on its API, SoundCloud requires an Artist Pro account to register an app, and Amazon Music and Qobuz have no public API. For those services, use Text / CSV.

## How it works

1. You pick the source and destination services.
2. You sign in to both with OAuth. Tokens are stored only in your browser (`localStorage`).
3. It reads the songs from the source playlist.
4. It looks up each song at the destination:
   - first by **ISRC** (exact match, in batches),
   - and if that fails, by **artist + title**, with a score that compares normalized title, artist, version (remix, live, etc.) and duration.
5. It creates the playlist (private or unlisted) and adds the matched songs in batches.
6. Progress is saved after each batch: if it stops, the quota runs out or you close the tab, you can **resume** where it left off.
7. At the end you can copy or download as CSV the list of songs that weren't found.

## Setup (once)

Quick summary. Detailed steps, what to put in each field and troubleshooting are in the **[tutorial](docs/TUTORIAL.en.md)**.

The **Redirect URI** is the page address: `https://carmelitasoftworks.github.io/OpenPlaylistTransfer/`. The app shows it with a copy button.

### Spotify
1. https://developer.spotify.com/dashboard → *Create app*.
2. Redirect URI: the one above. Check *Web API*.
3. Copy the *Client ID* into the app. You don't need the secret.

### Tidal
1. https://developer.tidal.com/dashboard → create an app.
2. Add the Redirect URI.
3. Enable the scopes `user.read`, `playlists.read`, `playlists.write` and `search.read`.
4. Copy the *Client ID*.

### YouTube Music
1. https://console.cloud.google.com/ → create a project and enable **YouTube Data API v3**.
2. *OAuth consent screen* → External → add yourself as a test user.
3. *Credentials* → *OAuth client ID* → **Web application**:
   - Authorized JavaScript origins: `https://carmelitasoftworks.github.io`
   - Authorized redirect URIs: the Redirect URI.
4. Copy the *Client ID*.

### Apple Music
1. With an Apple Developer account, create a *Key* with **MusicKit** and download the `.p8`.
2. Generate the developer token:
   ```bash
   node docs/apple-developer-token.mjs AuthKey_XXXXXXXXXX.p8 YOUR_TEAM_ID YOUR_KEY_ID
   ```
3. Paste the token into the app and connect. Apple will ask you to sign in.

## Run locally

It's a static page, no build step:

```bash
python3 -m http.server 8000
# open http://127.0.0.1:8000/  (Spotify accepts 127.0.0.1 as a Redirect URI)
```

## Structure

```
index.html            interface
css/style.css
js/core.js            OAuth/PKCE, HTTP with retries, song matching, CSV
js/app.js             interface and transfer engine (resumable)
js/providers/*.js     one module per service (same interface)
docs/                 tutorials (ES/EN) and Apple token script
```

To add a service, create a module in `js/providers/` with `listPlaylists`, `getTracks`, `createPlaylist`, `findMany` and `addTracks`, and register it in `js/app.js`.

## Privacy

No backend, no analytics, no trackers. Every request goes from your browser to each service's official API.

## Support

If it's useful to you, you can buy me a coffee on **[Ko-fi](https://ko-fi.com/carmelitasoftworks)** ☕

## License

[GPL-3.0](LICENSE) © Carmelita Softworks
