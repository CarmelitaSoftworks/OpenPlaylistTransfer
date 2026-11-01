// OpenPlaylistTransfer — interfaz y motor de transferencia.
import { store, REDIRECT_URI, readOAuthResponse, setLogger, log, chunk, toCsv, download } from "./core.js";
import spotify from "./providers/spotify.js";
import tidal from "./providers/tidal.js";
import youtube from "./providers/youtube.js";
import apple from "./providers/apple.js";
import file from "./providers/file.js";

const PROVIDERS = [spotify, tidal, youtube, apple, file];
const P = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};

let src = store.get("ui:src", "spotify");
let dst = store.get("ui:dst", "tidal");
let running = false, stopFlag = false;

/* ---------- registro ---------- */
setLogger((msg, cls) => {
  const L = $("log");
  L.prepend(h("div", { class: cls }, msg));
  while (L.children.length > 500) L.lastChild.remove();
});

/* ---------- paso 1: origen y destino ---------- */
function renderPickers() {
  for (const [boxId, role] of [["srcPick", "src"], ["dstPick", "dst"]]) {
    const box = $(boxId); box.innerHTML = "";
    for (const p of PROVIDERS) {
      if (role === "src" ? !p.canSource : !p.canDest) continue;
      const sel = (role === "src" ? src : dst) === p.id;
      box.append(h("button", {
        class: "chip" + (sel ? " sel" : ""), style: `--c:${p.color}`, type: "button",
        "aria-pressed": sel ? "true" : "false",
        onclick: () => {
          if (running) return;
          if (role === "src") { src = p.id; store.set("ui:src", src); } else { dst = p.id; store.set("ui:dst", dst); }
          renderAll();
        },
      }, h("i", { class: "dot" }), p.name));
    }
  }
  const same = src === dst && src !== "file";
  $("sameWarn").classList.toggle("hidden", !same);
}

/* ---------- paso 2: conexiones ---------- */
function renderConnections() {
  const box = $("conns"); box.innerHTML = "";
  const ids = [...new Set([src, dst])].filter((id) => !P[id].local);
  $("connCard").classList.toggle("hidden", !ids.length);
  for (const id of ids) {
    const p = P[id];
    const fields = p.fields.map((f) => {
      const inp = h("input", {
        id: `cfg-${id}-${f.key}`, autocomplete: "off", spellcheck: "false",
        placeholder: f.placeholder || "", type: f.secret ? "password" : "text",
        value: store.get(`cfg:${id}:${f.key}`, ""),
        oninput: (e) => { store.set(`cfg:${id}:${f.key}`, e.target.value.trim()); updateState(); },
      });
      return h("div", { class: f.advanced ? "adv" : "" }, h("label", { for: inp.id }, f.label), inp);
    });
    const hasAdv = p.fields.some((f) => f.advanced);
    const card = h("div", { class: "conn", style: `--c:${p.color}` },
      h("div", { class: "conn-head" },
        h("b", {}, p.name),
        h("span", { class: "pill", id: `state-${id}` }, "…")),
      ...fields.filter((f) => !f.classList.contains("adv")),
      hasAdv ? h("details", { class: "advbox" }, h("summary", {}, "Avanzado"), ...fields.filter((f) => f.classList.contains("adv"))) : null,
      h("details", { class: "help" }, h("summary", {}, `¿Cómo consigo las claves de ${p.name}?`), h("ol", { html: p.help })),
      h("div", { class: "row" },
        h("button", { class: "btn btn-c", id: `connect-${id}`, type: "button", onclick: () => connect(id) }, "Conectar"),
        h("button", { class: "btn ghost", id: `disc-${id}`, type: "button", onclick: () => { p.disconnect(); updateState(); loadPlaylists(); } }, "Desconectar")));
    box.append(card);
  }
}

async function connect(id) {
  const p = P[id];
  if (!p.isConfigured()) { toast(`Completa la clave de ${p.name} primero.`); return; }
  try { await p.connect(); updateState(); loadPlaylists(); }
  catch (e) { toast(`${p.name}: ${e.message}`); }
}

/* ---------- paso 3: playlist ---------- */
async function loadPlaylists() {
  const p = P[src];
  const sel = $("plSelect");
  $("textSrc").classList.toggle("hidden", !p.textSource);
  $("listSrc").classList.toggle("hidden", !!p.textSource);
  if (p.textSource) { updateState(); return; }
  sel.innerHTML = ""; sel.disabled = true;
  if (!p.isConnected()) { sel.append(new Option(`Conecta ${p.name} primero`, "")); updateState(); return; }
  sel.append(new Option("Cargando…", ""));
  try {
    const pls = await p.listPlaylists();
    sel.innerHTML = "";
    sel.append(new Option(pls.length ? "— Elige una —" : "No encontré playlists", ""));
    for (const pl of pls) sel.append(new Option(pl.count != null ? `${pl.name}  (${pl.count})` : pl.name, pl.id));
    sel.disabled = false;
  } catch (e) {
    sel.innerHTML = ""; sel.append(new Option("Error al cargar", ""));
    log(`${p.name}: ${e.message}`, "bad");
  }
  updateState();
}

/* ---------- estado general ---------- */
function updateState() {
  for (const id of [src, dst]) {
    const p = P[id], el = $(`state-${id}`);
    if (!el) continue;
    const on = p.isConnected();
    el.textContent = on ? "conectado" : p.isConfigured() ? "sin conectar" : "falta la clave";
    el.classList.toggle("on", on);
    $(`connect-${id}`).textContent = on ? "Reconectar" : "Conectar";
    $(`disc-${id}`).classList.toggle("hidden", !on);
  }
  const ready = P[src].isConnected() && P[dst].isConnected() && !(src === dst && src !== "file");
  $("go").disabled = !ready || running;
  const job = store.get("job");
  const showResume = job && !job.done && !running;
  $("resumeBox").classList.toggle("hidden", !showResume);
  if (showResume) $("resumeName").textContent = `${job.name} (${P[job.src].name} → ${P[job.dst].name}, ${job.idx}/${job.tracks.length || "?"})`;
  document.body.classList.toggle("busy", running);
}

function renderAll() {
  renderPickers();
  renderConnections();
  updateState();
  loadPlaylists();
}

/* ---------- motor de transferencia ---------- */
function render(job) {
  const total = job.tracks.length || 1;
  const pct = Math.min(100, Math.round((job.idx / total) * 100));
  $("barFill").style.width = pct + "%";
  $("nOk").textContent = job.found;
  $("nMiss").textContent = job.missing.length;
  $("nTotal").textContent = job.tracks.length;
  $("progText").textContent = job.done ? "Terminado." : `Procesando ${job.idx} de ${job.tracks.length} (${pct}%)`;
  $("missBox").classList.toggle("hidden", !job.missing.length);
  const url = job.dstPlaylist && P[job.dst].playlistUrl(job.dstPlaylist);
  $("dstLink").classList.toggle("hidden", !url);
  if (url) { $("dstLink").href = url; $("dstLink").textContent = `Abrir en ${P[job.dst].name}`; }
}

async function run(job) {
  const S = P[job.src], D = P[job.dst];
  running = true; stopFlag = false; updateState();
  $("progCard").classList.remove("hidden");
  $("progTitle").textContent = `${S.name} → ${D.name}: ${job.name}`;
  $("stopBtn").disabled = false;
  $("progCard").scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    if (!job.tracks.length) {
      log(`Leyendo canciones de ${S.name}…`);
      job.tracks = await S.getTracks(job.srcId, (n, t) => ($("progText").textContent = `Leyendo de ${S.name}: ${n}${t ? " de " + t : ""}`));
      if (!job.tracks.length) throw new Error("La playlist de origen está vacía o no se pudo leer.");
      log(`${job.tracks.length} canciones leídas de ${S.name}.`, "ok");
      store.set("job", job);
    }
    if (!job.dstPlaylist) {
      job.dstPlaylist = await D.createPlaylist(job.name, `Transferida desde ${S.name} con OpenPlaylistTransfer`);
      log(`Playlist creada en ${D.name}: ${job.name}`, "ok");
      store.set("job", job);
    }
    render(job);

    const step = D.batchSize || 20;
    while (job.idx < job.tracks.length && !stopFlag) {
      const part = job.tracks.slice(job.idx, job.idx + step);
      const ids = await D.findMany(part);
      const found = [];
      part.forEach((t, i) => {
        const label = `${t.artists.join(", ") || "?"} — ${t.title}`;
        if (ids[i]) { found.push(ids[i]); log("✓ " + label, "ok"); }
        else { job.missing.push(t); log("✗ " + label, "bad"); }
      });
      for (const b of chunk(found, D.addBatch || 50)) await D.addTracks(job.dstPlaylist, b);
      job.found += found.length;
      job.idx += part.length;
      store.set("job", job);
      render(job);
    }
    if (job.idx >= job.tracks.length) {
      await D.finish?.(job.dstPlaylist);
      job.done = true; store.set("job", job);
      $("progTitle").textContent = "¡Listo!";
      log(`Terminado: ${job.found} de ${job.tracks.length} canciones agregadas.`, "ok");
      $("stopBtn").disabled = true;
    } else {
      $("progTitle").textContent = "En pausa";
      log("En pausa. Puedes continuar cuando quieras.", "warn");
    }
  } catch (e) {
    log(e.message + " — el progreso quedó guardado, puedes continuar después.", "bad");
    $("progTitle").textContent = "Detenido";
  } finally {
    running = false; render(job); updateState();
  }
}

async function start() {
  const S = P[src];
  let srcId, name = $("plName").value.trim();
  if (S.textSource) {
    const txt = $("plText").value.trim();
    if (!txt) { toast("Pega tu lista o sube un CSV."); return; }
    store.set("file:text", txt);
    store.set("file:name", name);
    srcId = "text";
  } else {
    srcId = S.parseLink($("plUrl").value.trim()) || $("plSelect").value;
    if (!srcId) { toast("Elige una playlist o pega su link."); return; }
  }
  if (!name) {
    try { name = await S.playlistName(srcId); }
    catch (e) { toast(`No pude abrir esa playlist: ${e.message}`); return; }
  }
  const old = store.get("job");
  if (old && !old.done && !(await confirmBox("Hay una transferencia sin terminar. ¿Descartarla y empezar una nueva?"))) return;
  $("log").innerHTML = "";
  const job = { src, dst, srcId, name, tracks: [], idx: 0, found: 0, missing: [], dstPlaylist: null, done: false, at: Date.now() };
  store.set("job", job);
  run(job);
}

/* ---------- utilidades de interfaz ---------- */
let toastT;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 4000);
}
function confirmBox(msg) {
  return new Promise((res) => {
    const d = $("confirm"); $("confirmMsg").textContent = msg;
    d.classList.remove("hidden");
    const done = (v) => { d.classList.add("hidden"); res(v); };
    $("confirmYes").onclick = () => done(true);
    $("confirmNo").onclick = () => done(false);
  });
}
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); const o = btn.textContent; btn.textContent = "Copiado"; setTimeout(() => (btn.textContent = o), 1500); }
  catch { toast("No se pudo copiar."); }
}

/* ---------- eventos ---------- */
$("redir").value = REDIRECT_URI;
$("origin").textContent = location.origin;
$("copyRedir").onclick = (e) => copy(REDIRECT_URI, e.target);
$("swap").onclick = () => {
  if (running || !P[dst].canSource || !P[src].canDest) return;
  [src, dst] = [dst, src]; store.set("ui:src", src); store.set("ui:dst", dst); renderAll();
};
$("plSelect").onchange = () => { const o = $("plSelect").selectedOptions[0]; if (o?.value) { $("plUrl").value = ""; $("plName").placeholder = o.text.replace(/\s+\(\d+\)$/, ""); } };
$("plFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("plText").value = await f.text();
  if (!$("plName").value) $("plName").value = f.name.replace(/\.[^.]+$/, "");
};
$("plText").value = store.get("file:text", "");
$("go").onclick = start;
$("resumeBtn").onclick = () => { const j = store.get("job"); if (j) { $("log").innerHTML = ""; run(j); } };
$("discardBtn").onclick = () => { store.del("job"); updateState(); };
$("stopBtn").onclick = () => { stopFlag = true; $("stopBtn").disabled = true; log("Pausando al terminar el bloque actual…", "warn"); };
$("copyMiss").onclick = (e) => {
  const j = store.get("job"); if (!j) return;
  copy(j.missing.map((t) => `${t.artists.join(", ")} - ${t.title}`).join("\n"), e.target);
};
$("dlMiss").onclick = () => {
  const j = store.get("job"); if (!j) return;
  download("no_encontradas.csv", toCsv([["Artista", "Titulo", "Album", "ISRC"], ...j.missing.map((t) => [t.artists.join(", "), t.title, t.album || "", t.isrc || ""])]));
};

/* ---------- arranque ---------- */
(async () => {
  const r = readOAuthResponse();
  if (r) {
    if (r.error) toast(r.error);
    else {
      try { await P[r.provider].handleOAuth(r); toast(`${P[r.provider].name} conectado.`); }
      catch (e) { toast(`No se pudo conectar ${P[r.provider].name}: ${e.message}`); }
    }
  }
  renderAll();
  const job = store.get("job");
  if (job?.done) { $("progCard").classList.remove("hidden"); $("progTitle").textContent = `Última transferencia: ${job.name}`; render(job); }
})();
