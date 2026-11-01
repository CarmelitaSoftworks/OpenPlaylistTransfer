// Apple Music — MusicKit JS v3 + Apple Music API.
// Requiere un "developer token" (JWT) generado con una clave MusicKit de una
// cuenta Apple Developer (de pago). El token de usuario lo entrega MusicKit al iniciar sesión.
import { store, http, bestMatch, chunk, sleep } from "../core.js";

const API = "https://api.music.apple.com";
const SDK = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";

const devToken = () => store.get("cfg:apple:devToken", "");
let mk = null;

function loadSdk() {
  if (window.MusicKit) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SDK; s.async = true;
    s.onload = () => (window.MusicKit ? res() : document.addEventListener("musickitloaded", res, { once: true }));
    s.onerror = () => rej(new Error("No se pudo cargar MusicKit JS."));
    document.head.append(s);
  });
}
async function kit() {
  if (mk) return mk;
  await loadSdk();
  await window.MusicKit.configure({ developerToken: devToken(), app: { name: "OpenPlaylistTransfer", build: "1.0.0" } });
  mk = window.MusicKit.getInstance();
  return mk;
}
async function api(path, opts = {}) {
  const m = await kit();
  const ut = m.musicUserToken || store.get("tok:apple")?.access;
  if (!ut) throw new Error("Apple Music: conecta tu cuenta primero.");
  return http(API + path, {
    ...opts,
    headers: { Authorization: "Bearer " + devToken(), "Music-User-Token": ut, "Content-Type": "application/json", ...(opts.headers || {}) },
  }, { label: "Apple Music" });
}
async function storefront() {
  const m = await kit();
  if (m.storefrontId) return m.storefrontId;
  const j = await api("/v1/me/storefront");
  return j.data?.[0]?.id || "us";
}
const mapSong = (s) => ({
  id: s.id,
  title: s.attributes?.name,
  rawTitle: s.attributes?.name,
  artists: [s.attributes?.artistName].filter(Boolean),
  isrc: s.attributes?.isrc || null,
  dur: Math.round((s.attributes?.durationInMillis || 0) / 1000),
  album: s.attributes?.albumName || "",
});

export default {
  id: "apple",
  name: "Apple Music",
  color: "#fa4d6a",
  canSource: true,
  canDest: true,
  addBatch: 100,
  fields: [{ key: "devToken", label: "Apple Music developer token (JWT)", placeholder: "eyJhbGciOiJFUzI1NiIs…", secret: true }],
  help: `
    <li>Necesitas una cuenta de <a href="https://developer.apple.com/programs/" target="_blank" rel="noopener">Apple Developer</a> (de pago).</li>
    <li>En <i>Certificates, IDs & Profiles</i> → <i>Keys</i> crea una clave con <i>MusicKit</i> y descarga el archivo .p8.</li>
    <li>Genera el developer token (JWT ES256, máx. 6 meses) con tu Team ID y Key ID. En el README del repositorio hay un script para hacerlo.</li>
    <li>Pega el token aquí. Al conectar, Apple te pedirá iniciar sesión.</li>`,

  isConfigured: () => !!devToken(),
  isConnected: () => !!store.get("tok:apple"),
  async connect() {
    const m = await kit();
    const ut = await m.authorize();
    store.set("tok:apple", { access: ut, exp: Date.now() + 180 * 864e5 });
  },
  disconnect() { store.del("tok:apple"); try { mk?.unauthorize(); } catch {} },

  async listPlaylists() {
    const out = [];
    let url = "/v1/me/library/playlists?limit=100";
    while (url && out.length < 1000) {
      const j = await api(url);
      for (const p of j.data || []) out.push({ id: p.id, name: p.attributes?.name, count: null });
      url = j.next ? j.next + (j.next.includes("limit=") ? "" : "&limit=100") : null;
    }
    return out;
  },
  parseLink() { return null; },
  async playlistName(id) {
    return (await api(`/v1/me/library/playlists/${id}`)).data?.[0]?.attributes?.name;
  },
  async getTracks(id, onProgress) {
    const out = [];
    let url = `/v1/me/library/playlists/${id}/tracks?limit=100&include=catalog`;
    while (url) {
      const j = await api(url);
      for (const s of j.data || []) {
        const cat = s.relationships?.catalog?.data?.[0];
        out.push({ ...mapSong(cat || s), isrc: cat?.attributes?.isrc || null });
      }
      onProgress?.(out.length, j.meta?.total);
      url = j.next ? j.next + (j.next.includes("include=") ? "" : "&include=catalog") : null;
    }
    return out.map(({ id, rawTitle, ...t }) => t);
  },

  async createPlaylist(name, description) {
    const j = await api("/v1/me/library/playlists", {
      method: "POST",
      body: JSON.stringify({ attributes: { name, description } }),
    });
    return j.data?.[0]?.id;
  },
  async findMany(tracks) {
    const sf = await storefront();
    const byIsrc = {};
    const isrcs = [...new Set(tracks.map((t) => t.isrc).filter(Boolean).map((s) => s.toUpperCase()))];
    for (const part of chunk(isrcs, 25)) {
      try {
        const j = await api(`/v1/catalog/${sf}/songs?filter[isrc]=${part.join(",")}`);
        for (const s of j.data || []) {
          const i = s.attributes?.isrc?.toUpperCase();
          if (i && !byIsrc[i]) byIsrc[i] = s.id;
        }
      } catch { /* sigue con búsqueda */ }
    }
    const res = [];
    for (const t of tracks) {
      let id = t.isrc ? byIsrc[t.isrc.toUpperCase()] : null;
      if (!id) {
        const term = `${t.artists[0] || ""} ${t.title.replace(/\s*[\(\[].*?[\)\]]/g, "")}`.trim();
        try {
          const j = await api(`/v1/catalog/${sf}/search?types=songs&limit=10&term=${encodeURIComponent(term)}`);
          id = bestMatch(t, (j.results?.songs?.data || []).map(mapSong))?.id || null;
        } catch { id = null; }
        await sleep(80);
      }
      res.push(id);
    }
    return res;
  },
  async addTracks(plId, ids) {
    await api(`/v1/me/library/playlists/${plId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ data: ids.map((id) => ({ id, type: "songs" })) }),
    });
  },
  playlistUrl: () => "https://music.apple.com/library/playlists",
};
