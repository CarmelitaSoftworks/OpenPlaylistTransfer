// YouTube Music vía YouTube Data API v3 — OAuth implícito de Google (sin secret).
// Las playlists de YouTube Music son playlists de YouTube, así que aparecen en ambos.
// Cuota diaria por defecto: 10.000 unidades. Buscar = 100, agregar = 50
// → unas 65 canciones por día. La transferencia se puede continuar al día siguiente.
import { store, startOAuth, http, bestMatch, isoDur, chunk, sleep } from "../core.js";

const API = "https://www.googleapis.com/youtube/v3";
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = "https://www.googleapis.com/auth/youtube";

const cid = () => store.get("cfg:youtube:clientId", "");

function token() {
  const t = store.get("tok:youtube");
  if (!t) return null;
  if (Date.now() > t.exp) { store.del("tok:youtube"); return null; }
  return t.access;
}
async function api(path, opts = {}) {
  const tok = token();
  if (!tok) throw new Error("YouTube: la sesión expiró (dura 1 hora), vuelve a conectar y continúa.");
  try {
    return await http(API + path, { ...opts, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(opts.headers || {}) } }, { label: "YouTube" });
  } catch (e) {
    const reason = e.body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      const err = new Error("YouTube: se agotó la cuota diaria de la API. El progreso quedó guardado; continúa mañana.");
      err.fatal = true; throw err;
    }
    throw e;
  }
}

/** "Artista - Título (Official Video)" → { artists, title } */
function parseVideo(snippetTitle, channel) {
  let title = snippetTitle || "";
  let artists = [];
  const topic = /^(.*) - Topic$/.exec(channel || "");
  if (topic) artists = [topic[1]];
  else {
    const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
    if (m) { artists = [m[1]]; title = m[2]; }
    else if (channel) artists = [channel.replace(/VEVO$/i, "").trim()];
  }
  title = title.replace(/\s*[\(\[](official|video|audio|lyric|lyrics|visualizer|hd|4k|mv)[^\)\]]*[\)\]]/gi, "").trim();
  return { title, artists };
}

export default {
  id: "youtube",
  name: "YouTube Music",
  color: "#ff4e45",
  canSource: true,
  canDest: true,
  addBatch: 50,
  batchSize: 10,
  fields: [{ key: "clientId", label: "Google OAuth Client ID", placeholder: "xxxx.apps.googleusercontent.com" }],
  help: `
    <li>En <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> crea un proyecto y activa <i>YouTube Data API v3</i>.</li>
    <li>En <i>Pantalla de consentimiento de OAuth</i> elige "Externo" y agrégate como usuario de prueba.</li>
    <li>En <i>Credenciales</i> → <i>ID de cliente de OAuth</i> → tipo "Aplicación web". En <i>Orígenes de JavaScript</i> pon el dominio de esta página y en <i>URI de redireccionamiento</i> la Redirect URI.</li>
    <li>Copia el <i>Client ID</i>.</li>
    <li class="note">La cuota gratuita de YouTube alcanza para unas 65 canciones por día como destino. Como origen no hay problema.</li>`,

  isConfigured: () => !!cid(),
  isConnected: () => !!token(),
  connect() {
    return startOAuth({ provider: "youtube", authUrl: AUTH, clientId: cid(), scopes: SCOPES, mode: "token", extra: { include_granted_scopes: "true", prompt: "select_account" } });
  },
  async handleOAuth(r) {
    store.set("tok:youtube", { access: r.accessToken, refresh: null, exp: Date.now() + r.expiresIn * 1000 - 60000 });
  },
  disconnect() { store.del("tok:youtube"); },

  async listPlaylists() {
    const out = [{ id: "LL", name: "❤ Videos que me gustan", count: null }];
    let page = "";
    do {
      const j = await api(`/playlists?part=snippet,contentDetails&mine=true&maxResults=50${page ? "&pageToken=" + page : ""}`);
      for (const p of j.items || []) out.push({ id: p.id, name: p.snippet?.title, count: p.contentDetails?.itemCount ?? null });
      page = j.nextPageToken;
    } while (page && out.length < 1000);
    return out;
  },
  parseLink(s) {
    const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(s || "");
    return m ? m[1] : null;
  },
  async playlistName(id) {
    if (id === "LL") return "Videos que me gustan";
    const j = await api(`/playlists?part=snippet&id=${id}`);
    return j.items?.[0]?.snippet?.title || "Playlist de YouTube";
  },
  async getTracks(id, onProgress) {
    const items = [];
    let page = "";
    do {
      const j = await api(`/playlistItems?part=snippet,contentDetails&playlistId=${id}&maxResults=50${page ? "&pageToken=" + page : ""}`);
      for (const it of j.items || []) {
        const sn = it.snippet || {};
        if (!sn.title || sn.title === "Deleted video" || sn.title === "Private video") continue;
        items.push({ vid: it.contentDetails?.videoId, ...parseVideo(sn.title, sn.videoOwnerChannelTitle) });
      }
      onProgress?.(items.length, j.pageInfo?.totalResults);
      page = j.nextPageToken;
    } while (page);
    // duraciones (1 unidad por cada 50 videos)
    for (const part of chunk(items, 50)) {
      const j = await api(`/videos?part=contentDetails&id=${part.map((x) => x.vid).join(",")}`).catch(() => ({}));
      const d = Object.fromEntries((j.items || []).map((v) => [v.id, isoDur(v.contentDetails?.duration)]));
      part.forEach((x) => (x.dur = d[x.vid] || 0));
    }
    return items.map(({ title, artists, dur }) => ({ title, artists, dur, isrc: null, album: "" }));
  },

  async createPlaylist(name, description) {
    const j = await api("/playlists?part=snippet,status", {
      method: "POST",
      body: JSON.stringify({ snippet: { title: name, description }, status: { privacyStatus: "private" } }),
    });
    return j.id;
  },
  async findMany(tracks) {
    const res = [];
    for (const t of tracks) {
      const q = `${t.artists[0] || ""} ${t.title}`.trim();
      const j = await api(`/search?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(q)}`);
      const cands = (j.items || []).map((v) => {
        const p = parseVideo(v.snippet?.title, v.snippet?.channelTitle);
        return { id: v.id?.videoId, title: p.title, rawTitle: v.snippet?.title, artists: p.artists, dur: 0 };
      });
      // YouTube no da duración en la búsqueda: umbral algo más permisivo
      res.push(bestMatch({ ...t, dur: 0 }, cands, 0.7)?.id || null);
      await sleep(100);
    }
    return res;
  },
  async addTracks(plId, ids) {
    for (const videoId of ids) {
      await api("/playlistItems?part=snippet", {
        method: "POST",
        body: JSON.stringify({ snippet: { playlistId: plId, resourceId: { kind: "youtube#video", videoId } } }),
      });
    }
  },
  playlistUrl: (id) => `https://music.youtube.com/playlist?list=${id}`,
};
