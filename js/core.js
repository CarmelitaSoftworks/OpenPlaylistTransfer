// OpenPlaylistTransfer — utilidades compartidas
// Licencia GPL-3.0. Todo corre en el navegador del usuario.

export const REDIRECT_URI = location.origin + location.pathname;

/* ---------- almacenamiento local (tolerante a fallos) ---------- */
export const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem("opt:" + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) { try { localStorage.setItem("opt:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("opt:" + k); } catch {} },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- PKCE ---------- */
export function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function randStr(n = 64) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return b64url(a).slice(0, n);
}
export async function pkcePair() {
  const verifier = randStr(64);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

/**
 * Inicia un login OAuth por redirección.
 * mode "pkce": authorization code + PKCE (Spotify, Tidal)
 * mode "token": implicit (Google), el token vuelve en el fragmento (#)
 */
export async function startOAuth({ provider, authUrl, clientId, scopes, mode = "pkce", extra = {} }) {
  const state = provider + "." + randStr(16);
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: REDIRECT_URI, scope: scopes, state, ...extra });
  if (mode === "pkce") {
    const { verifier, challenge } = await pkcePair();
    store.set("oauth", { provider, verifier, state });
    q.set("response_type", "code");
    q.set("code_challenge_method", "S256");
    q.set("code_challenge", challenge);
  } else {
    store.set("oauth", { provider, state });
    q.set("response_type", "token");
  }
  location.href = authUrl + "?" + q.toString();
}

/** Lee la respuesta OAuth de la URL (si la hay) y la limpia. */
export function readOAuthResponse() {
  const qs = new URLSearchParams(location.search);
  const hs = new URLSearchParams(location.hash.replace(/^#/, ""));
  const src = qs.has("code") || qs.has("error") ? qs : (hs.has("access_token") || hs.has("error") ? hs : null);
  if (!src) return null;
  history.replaceState(null, "", REDIRECT_URI);
  const saved = store.get("oauth");
  store.del("oauth");
  if (!saved || saved.state !== src.get("state")) {
    return { error: "La respuesta de inicio de sesión no coincide. Intenta de nuevo." };
  }
  if (src.has("error")) return { provider: saved.provider, error: src.get("error_description") || src.get("error") };
  return {
    provider: saved.provider,
    code: src.get("code"),
    verifier: saved.verifier,
    accessToken: src.get("access_token"),
    expiresIn: +src.get("expires_in") || 3600,
  };
}

/** Intercambio/refresh de token estándar (form-urlencoded). */
export async function tokenRequest(provider, tokenUrl, clientId, body) {
  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || "HTTP " + r.status);
  const old = store.get("tok:" + provider);
  const tok = {
    access: j.access_token,
    refresh: j.refresh_token || old?.refresh || null,
    exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000,
  };
  store.set("tok:" + provider, tok);
  return tok;
}

/* ---------- registro de eventos para la interfaz ---------- */
let logger = () => {};
export function setLogger(fn) { logger = fn; }
export function log(msg, cls = "") { logger(msg, cls); }

/**
 * fetch con reintentos: 429 (respeta Retry-After), 5xx y un reintento en 401
 * (onAuthFail permite refrescar el token).
 */
export async function http(url, opts = {}, { onAuthFail, label = "" } = {}, tries = 0) {
  const r = await fetch(url, opts);
  if (r.status === 429 && tries < 8) {
    const wait = Math.min((+r.headers.get("Retry-After") || 2 ** tries) * 1000, 60000);
    log(`${label}: límite de la API, esperando ${Math.round(wait / 1000)} s…`, "warn");
    await sleep(wait);
    return http(url, opts, { onAuthFail, label }, tries + 1);
  }
  if (r.status === 401 && onAuthFail && tries < 1) {
    const newOpts = await onAuthFail(opts);
    if (newOpts) return http(url, newOpts, { onAuthFail, label }, tries + 1);
  }
  if (r.status >= 500 && tries < 3) {
    await sleep(1500 * (tries + 1));
    return http(url, opts, { onAuthFail, label }, tries + 1);
  }
  if (r.status === 204) return {};
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) {
    const msg = j?.error?.message || j?.errors?.[0]?.detail || j?.errors?.[0]?.title ||
      j?.errors?.[0]?.code || j?.error_description || (typeof j?.error === "string" ? j.error : "") || "HTTP " + r.status;
    const e = new Error(`${label ? label + ": " : ""}${msg}`);
    e.status = r.status; e.body = j;
    throw e;
  }
  return j;
}

/* ---------- coincidencia de canciones ---------- */
export function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, "")       // (Original Mix), [Remastered]
    .replace(/\s+-\s+.*$/, "")                       // " - Remastered 2011"
    .replace(/\b(feat|ft|featuring)\.?\s.*$/, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
/** Título base para buscar (sin paréntesis ni sufijos). */
export function baseTitle(t) {
  return (t || "").replace(/\s*[\(\[][^\)\]]*[\)\]]/g, "").replace(/\s+-\s+.*$/, "").trim();
}
/** Detalles de versión que sí importan (remix, live, etc.). */
function versionTags(t) {
  const s = (t || "").toLowerCase();
  return ["remix", "live", "acoustic", "instrumental", "edit", "extended", "vip", "dub", "rework", "bootleg"]
    .filter((k) => s.includes(k)).sort().join(",");
}

/**
 * Puntúa un candidato frente a la canción original. Devuelve 0..1.
 * track/cand: { title, artists[], dur (s) }
 */
export function score(track, cand) {
  const tA = norm(track.title), tB = norm(cand.title);
  if (!tA || !tB) return 0;
  let s = 0;
  if (tA === tB) s += 0.5;
  else if (tA.includes(tB) || tB.includes(tA)) s += 0.35;
  else return 0;

  const aA = (track.artists || []).map(norm).filter(Boolean);
  const aB = (cand.artists || []).map(norm).filter(Boolean);
  if (!aB.length) s += 0.1; // sin datos de artista (p. ej. YouTube): neutral
  else if (aA.some((a) => aB.some((b) => a === b || a.includes(b) || b.includes(a)))) s += 0.3;
  else if (aB.some((b) => tB.includes(b) || norm(cand.rawTitle || "").includes(b))) s += 0.1;

  if (versionTags(track.title) === versionTags(cand.rawTitle || cand.title)) s += 0.1;
  if (track.dur && cand.dur) {
    const d = Math.abs(track.dur - cand.dur);
    if (d <= 3) s += 0.1; else if (d <= 10) s += 0.05; else if (d > 30) s -= 0.3;
  }
  return Math.max(0, Math.min(1, s));
}
export function bestMatch(track, cands, min = 0.75) {
  let best = null, bestS = 0;
  for (const c of cands) {
    const s = score(track, c);
    if (s > bestS) { best = c; bestS = s; }
  }
  return bestS >= min ? best : null;
}

/** Duración ISO 8601 (PT3M25S) → segundos. */
export function isoDur(s) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(s || "");
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + Math.round(+m[3] || 0);
}

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ---------- CSV ---------- */
export function toCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}
export function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
export function download(name, text, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
