// Texto / CSV — para servicios sin API abierta (Deezer, SoundCloud, Amazon Music, Qobuz…).
// Origen: pega una lista "Artista - Título" o sube un CSV (Exportify, TuneMyMusic, Soundiiz…).
// Destino: descarga un CSV con artista, título, álbum, ISRC y duración.
import { store, parseCsv, toCsv, download } from "../core.js";

function pick(headers, names) {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const n of names) {
    const i = h.findIndex((x) => x === n || x.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseList(text) {
  text = (text || "").replace(/^﻿/, "").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const head = rows[0] || [];
  const iTitle = pick(head, ["track name", "titulo", "título", "title", "song", "name", "track"]);
  const iArtist = pick(head, ["artist name", "artista", "artist"]);
  if (rows.length > 1 && iTitle >= 0 && iArtist >= 0) {
    const iIsrc = pick(head, ["isrc"]);
    const iAlbum = pick(head, ["album name", "álbum", "album"]);
    const iDur = pick(head, ["duration (ms)", "duration_ms", "duración", "duration"]);
    return rows.slice(1).map((r) => {
      let dur = iDur >= 0 ? r[iDur] : "";
      dur = /^\d+$/.test(dur) ? (+dur > 10000 ? Math.round(+dur / 1000) : +dur)
        : /^\d+:\d{2}$/.test(dur) ? dur.split(":").reduce((a, b) => a * 60 + +b, 0) : 0;
      return {
        title: (r[iTitle] || "").trim(),
        artists: (r[iArtist] || "").split(/\s*[,;]\s*|\s+&\s+/).map((s) => s.trim()).filter(Boolean),
        isrc: iIsrc >= 0 ? (r[iIsrc] || "").trim() || null : null,
        album: iAlbum >= 0 ? r[iAlbum] || "" : "",
        dur,
      };
    }).filter((t) => t.title);
  }
  // Una canción por línea: "Artista - Título"
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    l = l.replace(/^\d+[\.\)]\s*/, "");
    const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(l);
    return m
      ? { artists: m[1].split(/\s*,\s*|\s+&\s+/), title: m[2], isrc: null, album: "", dur: 0 }
      : { artists: [], title: l, isrc: null, album: "", dur: 0 };
  });
}

let buffer = [];

export default {
  id: "file",
  name: "Texto / CSV",
  color: "#c9ced6",
  canSource: true,
  canDest: true,
  addBatch: 1000,
  local: true,           // no requiere conexión
  textSource: true,      // la interfaz muestra un cuadro de texto en lugar de playlists
  fields: [],
  help: `<li>Úsalo con servicios que no tienen API abierta (Deezer, SoundCloud, Amazon Music, Qobuz…).</li>
    <li>Como origen, pega una canción por línea (<code>Artista - Título</code>) o sube un CSV exportado con Exportify, TuneMyMusic, Soundiiz, etc.</li>
    <li>Como destino, descargas un CSV para importarlo en otro lado.</li>`,

  isConfigured: () => true,
  isConnected: () => true,
  connect() {},
  disconnect() {},

  async listPlaylists() { return []; },
  parseLink() { return null; },
  async playlistName() { return store.get("file:name", "") || "Playlist importada"; },
  async getTracks() { return parseList(store.get("file:text", "")); },

  async createPlaylist(name) { buffer = []; store.set("file:out", []); return name; },
  async findMany(tracks) { return tracks.map((t) => JSON.stringify(t)); },
  async addTracks(_pl, items) {
    buffer = store.get("file:out", []) || [];
    buffer.push(...items.map((s) => JSON.parse(s)));
    store.set("file:out", buffer);
  },
  async finish(name) {
    buffer = store.get("file:out", []) || [];
    const rows = [["Artista", "Titulo", "Album", "ISRC", "Duracion (s)"],
      ...buffer.map((t) => [t.artists.join(", "), t.title, t.album || "", t.isrc || "", t.dur || ""])];
    download(`${(name || "playlist").replace(/[^\w\- ]+/g, "_")}.csv`, toCsv(rows));
    store.del("file:out"); buffer = [];
  },
  playlistUrl: () => null,
};
