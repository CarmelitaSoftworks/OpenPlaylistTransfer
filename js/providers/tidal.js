// TIDAL API v2 (openapi.tidal.com, JSON:API) — Authorization Code + PKCE.
import { store, startOAuth, tokenRequest, http, bestMatch, isoDur, chunk, REDIRECT_URI, sleep } from "../core.js";

const API = "https://openapi.tidal.com/v2";
const AUTH = "https://login.tidal.com/authorize";
const TOKEN = "https://auth.tidal.com/v1/oauth2/token";
const DEFAULT_SCOPES = "user.read playlists.read playlists.write search.read";
const JSONAPI = { "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json" };

const cid = () => store.get("cfg:tidal:clientId", "");
const scopes = () => store.get("cfg:tidal:scopes", "") || DEFAULT_SCOPES;

async function token() {
  let t = store.get("tok:tidal");
  if (!t) return null;
  if (Date.now() > t.exp) {
    if (!t.refresh) { store.del("tok:tidal"); return null; }
    try { t = await tokenRequest("tidal", TOKEN, cid(), { grant_type: "refresh_token", refresh_token: t.refresh, scope: scopes() }); }
    catch { store.del("tok:tidal"); return null; }
  }
  return t.access;
}

async function api(path, opts = {}) {
  const tok = await token();
  if (!tok) throw new Error("Tidal: la sesión expiró, vuelve a conectar.");
  const url = path.startsWith("http") ? path : API + path;
  const o = { ...opts, headers: { Authorization: "Bearer " + tok, ...JSONAPI, ...(opts.headers || {}) } };
  return http(url, o, {
    label: "Tidal",
    onAuthFail: async (prev) => {
      const t = store.get("tok:tidal"); if (!t) return null;
      t.exp = 0; store.set("tok:tidal", t);
      const nt = await token(); if (!nt) return null;
      return { ...prev, headers: { ...prev.headers, Authorization: "Bearer " + nt } };
    },
  });
}
const nextUrl = (j) => {
  const n = j?.links?.next;
  if (!n) return null;
  return n.startsWith("http") ? n : API + (n.startsWith("/") ? n : "/" + n);
};

let me = null;
async function user() {
  if (me) return me;
  const j = await api("/users/me");
  me = { id: j.data.id, country: (store.get("cfg:tidal:country", "") || j.data.attributes?.country || "US").toUpperCase() };
  return me;
}

/** Detalle de tracks (título, ISRC, duración, artistas) por IDs. */
async function trackDetails(ids, cc) {
  const out = {};
  for (const part of chunk(ids, 20)) {
    const q = new URLSearchParams({ countryCode: cc, include: "artists" });
    part.forEach((id) => q.append("filter[id]", id));
    const j = await api(`/tracks?${q}`);
    const artists = {};
    for (const inc of j.included || []) if (inc.type === "artists") artists[inc.id] = inc.attributes?.name;
    for (const t of j.data || []) {
      out[t.id] = {
        title: t.attributes?.version ? `${t.attributes.title} (${t.attributes.version})` : t.attributes?.title,
        artists: (t.relationships?.artists?.data || []).map((a) => artists[a.id]).filter(Boolean),
        isrc: t.attributes?.isrc || null,
        dur: isoDur(t.attributes?.duration),
        album: "",
      };
    }
  }
  return out;
}

export default {
  id: "tidal",
  name: "Tidal",
  color: "#33c3ff",
  canSource: true,
  canDest: true,
  addBatch: 20,
  fields: [
    { key: "clientId", label: "Tidal Client ID", placeholder: "ej. Ks8wEM…" },
    { key: "scopes", label: "Permisos (avanzado)", placeholder: DEFAULT_SCOPES, advanced: true },
    { key: "country", label: "País del catálogo (vacío = el de tu cuenta)", placeholder: "CL", advanced: true },
  ],
  help: `
    <li>Entra a <a href="https://developer.tidal.com/dashboard" target="_blank" rel="noopener">developer.tidal.com/dashboard</a> y crea una app.</li>
    <li>Agrega la Redirect URI de esta página.</li>
    <li>Activa los permisos <code>user.read</code>, <code>playlists.read</code>, <code>playlists.write</code> y <code>search.read</code>.</li>
    <li>Copia el <i>Client ID</i>.</li>`,

  isConfigured: () => !!cid(),
  isConnected: () => !!store.get("tok:tidal"),
  connect() {
    return startOAuth({ provider: "tidal", authUrl: AUTH, clientId: cid(), scopes: scopes() });
  },
  async handleOAuth(r) {
    await tokenRequest("tidal", TOKEN, cid(), {
      grant_type: "authorization_code", code: r.code, redirect_uri: REDIRECT_URI, code_verifier: r.verifier, scope: scopes(),
    });
    me = null;
  },
  disconnect() { store.del("tok:tidal"); me = null; },

  async listPlaylists() {
    const { country } = await user();
    const out = [];
    let url = `/playlists?countryCode=${country}&filter[owners.id]=me`;
    while (url && out.length < 1000) {
      const j = await api(url);
      for (const p of j.data || []) out.push({ id: p.id, name: p.attributes?.name, count: p.attributes?.numberOfItems ?? null });
      url = nextUrl(j);
    }
    return out;
  },
  parseLink(s) {
    const m = /tidal\.com\/(?:browse\/)?playlist\/([0-9a-f-]{36})/i.exec(s || "");
    return m ? m[1] : null;
  },
  async playlistName(id) {
    const { country } = await user();
    return (await api(`/playlists/${id}?countryCode=${country}`)).data?.attributes?.name;
  },
  async getTracks(id, onProgress) {
    const { country } = await user();
    const ids = [];
    let url = `/playlists/${id}/relationships/items?countryCode=${country}`;
    while (url) {
      const j = await api(url);
      for (const it of j.data || []) if (it.type === "tracks") ids.push(it.id);
      onProgress?.(ids.length, null);
      url = nextUrl(j);
    }
    const details = await trackDetails(ids, country);
    return ids.map((i) => details[i]).filter(Boolean);
  },

  async createPlaylist(name, description) {
    const body = { data: { type: "playlists", attributes: { name, description, accessType: "UNLISTED" } } };
    const j = await api("/playlists", { method: "POST", body: JSON.stringify(body) });
    return j.data.id;
  },
  async findMany(tracks) {
    const { country } = await user();
    // 1) ISRC en lote
    const byIsrc = {};
    const isrcs = [...new Set(tracks.map((t) => t.isrc).filter(Boolean).map((s) => s.toUpperCase()))];
    if (isrcs.length) {
      try {
        const q = new URLSearchParams({ countryCode: country });
        isrcs.forEach((i) => q.append("filter[isrc]", i));
        const j = await api(`/tracks?${q}`);
        for (const t of j.data || []) {
          const i = t.attributes?.isrc?.toUpperCase();
          if (i && !byIsrc[i]) byIsrc[i] = t.id;
        }
      } catch { /* sigue con búsqueda por nombre */ }
    }
    // 2) Búsqueda por texto para el resto
    const res = [];
    for (const t of tracks) {
      let id = t.isrc ? byIsrc[t.isrc.toUpperCase()] : null;
      if (!id) {
        const query = `${t.artists[0] || ""} ${t.title.replace(/\s*[\(\[].*?[\)\]]/g, "")}`.trim();
        try {
          const j = await api(`/searchResults/${encodeURIComponent(query)}/relationships/tracks?countryCode=${country}&include=tracks&explicitFilter=INCLUDE`);
          const cands = (j.included || []).filter((x) => x.type === "tracks").map((x) => ({
            id: x.id,
            title: x.attributes?.title,
            rawTitle: `${x.attributes?.title || ""} ${x.attributes?.version || ""}`,
            artists: [], // la búsqueda no trae artistas; la consulta ya los incluye
            dur: isoDur(x.attributes?.duration),
          }));
          id = bestMatch(t, cands)?.id || null;
        } catch { id = null; }
        await sleep(120);
      }
      res.push(id);
    }
    return res;
  },
  async addTracks(plId, ids) {
    const body = { data: ids.map((id) => ({ id: String(id), type: "tracks" })) };
    await api(`/playlists/${plId}/relationships/items`, { method: "POST", body: JSON.stringify(body) });
  },
  playlistUrl: (id) => `https://tidal.com/playlist/${id}`,
};
