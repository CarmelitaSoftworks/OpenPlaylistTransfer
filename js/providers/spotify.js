// Spotify Web API — Authorization Code + PKCE (sin client secret).
// Endpoints según los cambios de febrero 2026 para apps en Development Mode:
// /playlists/{id}/items, POST /me/playlists, búsqueda con limit máx. 10.
import { store, startOAuth, tokenRequest, http, bestMatch, REDIRECT_URI, sleep } from "../core.js";

const API = "https://api.spotify.com/v1";
const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const SCOPES = "playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-library-read";

const cid = () => store.get("cfg:spotify:clientId", "");

async function token() {
  let t = store.get("tok:spotify");
  if (!t) return null;
  if (Date.now() > t.exp) {
    if (!t.refresh) { store.del("tok:spotify"); return null; }
    try { t = await tokenRequest("spotify", TOKEN, cid(), { grant_type: "refresh_token", refresh_token: t.refresh }); }
    catch { store.del("tok:spotify"); return null; }
  }
  return t.access;
}

async function api(path, opts = {}) {
  const tok = await token();
  if (!tok) throw new Error("Spotify: la sesión expiró, vuelve a conectar.");
  const url = path.startsWith("http") ? path : API + path;
  const o = { ...opts, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(opts.headers || {}) } };
  return http(url, o, {
    label: "Spotify",
    onAuthFail: async (prev) => {
      const t = store.get("tok:spotify"); if (!t) return null;
      t.exp = 0; store.set("tok:spotify", t);
      const nt = await token(); if (!nt) return null;
      return { ...prev, headers: { ...prev.headers, Authorization: "Bearer " + nt } };
    },
  });
}

function mapTrack(t) {
  return {
    title: t.name,
    artists: (t.artists || []).map((a) => a.name),
    album: t.album?.name || "",
    isrc: t.external_ids?.isrc || null,
    dur: Math.round((t.duration_ms || 0) / 1000),
  };
}

export default {
  id: "spotify",
  name: "Spotify",
  color: "#1ed760",
  canSource: true,
  canDest: true,
  addBatch: 100,
  fields: [{ key: "clientId", label: "Spotify Client ID", placeholder: "ej. 3f9a2c…" }],
  help: `
    <li>Entra a <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> → <i>Create app</i>.</li>
    <li>En <i>Redirect URIs</i> pega la Redirect URI de esta página y marca <i>Web API</i>.</li>
    <li>Copia el <i>Client ID</i> (el secret no hace falta).</li>
    <li class="note">Spotify exige que el dueño de la app tenga Premium y permite hasta 5 usuarios en modo desarrollo. Solo puede leer playlists tuyas o colaborativas.</li>`,

  isConfigured: () => !!cid(),
  isConnected: () => !!store.get("tok:spotify"),
  connect() {
    return startOAuth({ provider: "spotify", authUrl: AUTH, clientId: cid(), scopes: SCOPES });
  },
  async handleOAuth(r) {
    await tokenRequest("spotify", TOKEN, cid(), {
      grant_type: "authorization_code", code: r.code, redirect_uri: REDIRECT_URI, code_verifier: r.verifier,
    });
  },
  disconnect() { store.del("tok:spotify"); },

  async listPlaylists() {
    const out = [{ id: "__liked__", name: "❤ Canciones que te gustan", count: null }];
    let url = "/me/playlists?limit=50";
    while (url && out.length < 1000) {
      const j = await api(url);
      for (const p of j.items || []) if (p) out.push({ id: p.id, name: p.name, count: p.items?.total ?? p.tracks?.total ?? null });
      url = j.next;
    }
    return out;
  },
  parseLink(s) {
    const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]{22})|spotify:playlist:([A-Za-z0-9]{22})/.exec(s || "");
    return m ? m[1] || m[2] : null;
  },
  async playlistName(id) {
    if (id === "__liked__") return "Canciones que te gustan";
    return (await api(`/playlists/${id}?fields=name`)).name;
  },
  async getTracks(id, onProgress) {
    const out = [];
    let url = id === "__liked__" ? "/me/tracks?limit=50" : `/playlists/${id}/items?limit=50&additional_types=track`;
    while (url) {
      const j = await api(url);
      for (const it of j.items || []) {
        const t = it?.item || it?.track;
        if (!t || (t.type && t.type !== "track") || !t.id || t.is_local) continue;
        out.push(mapTrack(t));
      }
      onProgress?.(out.length, j.total);
      url = j.next;
    }
    return out;
  },

  async createPlaylist(name, description) {
    const j = await api("/me/playlists", { method: "POST", body: JSON.stringify({ name, description, public: false }) });
    return j.id;
  },
  async findMany(tracks) {
    const res = [];
    for (const t of tracks) {
      let uri = null;
      if (t.isrc) {
        const j = await api(`/search?type=track&limit=5&q=${encodeURIComponent("isrc:" + t.isrc)}`).catch(() => null);
        const hit = j?.tracks?.items?.[0];
        if (hit) uri = hit.uri;
      }
      if (!uri) {
        const q = `track:${t.title.replace(/\s*[\(\[].*?[\)\]]/g, "")} artist:${t.artists[0] || ""}`.trim();
        let j = await api(`/search?type=track&limit=10&q=${encodeURIComponent(q)}`).catch(() => null);
        let cands = (j?.tracks?.items || []).map((x) => ({ ...mapTrack(x), rawTitle: x.name, uri: x.uri }));
        let m = bestMatch(t, cands);
        if (!m) {
          j = await api(`/search?type=track&limit=10&q=${encodeURIComponent(`${t.artists[0] || ""} ${t.title}`)}`).catch(() => null);
          cands = (j?.tracks?.items || []).map((x) => ({ ...mapTrack(x), rawTitle: x.name, uri: x.uri }));
          m = bestMatch(t, cands);
        }
        uri = m?.uri || null;
      }
      res.push(uri);
      await sleep(60);
    }
    return res;
  },
  async addTracks(plId, uris) {
    await api(`/playlists/${plId}/items`, { method: "POST", body: JSON.stringify({ uris }) });
  },
  playlistUrl: (id) => `https://open.spotify.com/playlist/${id}`,
};
