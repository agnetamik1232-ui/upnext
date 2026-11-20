// Up Next — shared app state and small helpers used by every screen.
import { todayISO, parts } from "./dates.js";
import * as store from "./store.js";

export const app = { S: null, today: todayISO(), view: "home", demo: false, photo: false, renderFn: null };
export const actions = {};
export const forms = {};
export const live = {};

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let nf = null, nf0 = null, nfKey = "";
function formatters() {
  const { currency, locale } = app.S.profile;
  const key = currency + locale;
  if (key !== nfKey) {
    try {
      nf = new Intl.NumberFormat(locale, { style: "currency", currency });
      nf0 = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });
    } catch {
      nf = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
      nf0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    }
    nfKey = key;
  }
}
// Money with cents, money rounded, money rounded down (for "safe to spend" so we never overstate).
export const fmt = n => { formatters(); return nf.format(Number(n) || 0); };
export const fmtR = n => { formatters(); return nf0.format(Math.round(Number(n) || 0)); };
export const fmtDown = n => { formatters(); return nf0.format(Math.floor((Number(n) || 0) + 1e-9)); };
export const money = (n, kind = "c") => `<span class="m num">${esc(kind === "r" ? fmtR(n) : kind === "d" ? fmtDown(n) : fmt(n))}</span>`;
export const symbol = () => { formatters(); return (nf.formatToParts(0).find(p => p.type === "currency") || {}).value || "$"; };

const dtf = {};
const fmtDate = (s, opts) => {
  const k = app.S.profile.locale + JSON.stringify(opts);
  if (!dtf[k]) { try { dtf[k] = new Intl.DateTimeFormat(app.S.profile.locale, { ...opts, timeZone: "UTC" }); } catch { dtf[k] = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }); } }
  const [y, m, d] = parts(s);
  return dtf[k].format(new Date(Date.UTC(y, m - 1, d)));
};
export const fd = s => fmtDate(s, { weekday: "short", day: "numeric", month: "short" });        // Fri 20 Nov
export const fdLong = s => fmtDate(s, { weekday: "long", day: "numeric", month: "long" });      // Thursday 19 November
export const fdShort = s => fmtDate(s, { day: "numeric", month: "short" });                     // 20 Nov
export const fWeekday = s => fmtDate(s, { weekday: "short" });
export const fMonth = ym => fmtDate(ym + "-01", { month: "long", year: "numeric" });
export const fMonthShort = ym => fmtDate(ym + "-01", { month: "short" });
export const fMonthYear = s => fmtDate(s, { month: "long", year: "numeric" });

export const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0).toFixed(1) + "%";
export const parseMoney = v => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,56
  else s = s.replace(/,/g, "");                                            // 1,234.56
  return Number(s);
};

export function render() { app.renderFn && app.renderFn(); }

export function commit(mutate, opts = {}) {
  mutate && mutate(app.S);
  store.save(app.S);
  if (opts.render !== false) render();
}

// ---------- Toast ----------
let toastTimer = null;
export function toast(msg, undo) {
  const el = document.getElementById("toast");
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" data-act="toast-undo">Undo</button>` : ""}`;
  actions["toast-undo"] = () => { undo && undo(); hideToast(); };
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 6000 : 3200);
}
function hideToast() { document.getElementById("toast").classList.remove("show"); }

// ---------- Sheets (modals) ----------
let lastFocus = null;
export function openSheet(html, { wide = false, label = "Dialog", onClose } = {}) {
  closeSheet(true);
  lastFocus = document.activeElement;
  const root = document.getElementById("sheet-root");
  root.innerHTML = `<div class="scrim" data-scrim><div class="sheet${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div></div>`;
  root._onClose = onClose;
  const first = root.querySelector("[autofocus]") || root.querySelector("input,select,button");
  setTimeout(() => first && first.focus({ preventScroll: true }), 30);
}
export function updateSheet(html) {
  const sh = document.querySelector("#sheet-root .sheet");
  if (sh) sh.innerHTML = html;
}
export function closeSheet(silent) {
  const root = document.getElementById("sheet-root");
  if (!root || !root.innerHTML) return;
  const cb = root._onClose; root._onClose = null;
  root.innerHTML = "";
  if (!silent && cb) cb();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
export const isSheetOpen = () => !!document.getElementById("sheet-root")?.innerHTML;
export const sheetHead = (title, close = "Close") => `<div class="sheet-head"><h2 class="fr">${title}</h2><button type="button" class="x" data-act="close-sheet">${close}</button></div>`;

// ---------- Files ----------
export async function shareOrDownload(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = accept; i.style.display = "none";
    i.onchange = () => { const f = i.files && i.files[0]; i.remove(); if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve({ name: f.name, text: String(r.result) }); r.onerror = () => resolve(null); r.readAsText(f); };
    document.body.appendChild(i); i.click();
  });
}

// Several files at once (Letterboxd and IMDb exports come as more than one CSV).
export function pickFiles(accept) {
  return new Promise(resolve => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = accept; i.multiple = true; i.style.display = "none";
    i.onchange = async () => {
      const files = [...(i.files || [])]; i.remove();
      const read = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r({ name: f.name, text: String(fr.result) }); fr.onerror = () => r(null); fr.readAsText(f); });
      resolve((await Promise.all(files.map(read))).filter(Boolean));
    };
    document.body.appendChild(i); i.click();
  });
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
