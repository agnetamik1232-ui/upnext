// Up Next — saving on the buyer's own device (IndexedDB, with localStorage as a fallback).
import { normalise } from "./model.js";

const DB = "upnext", STORE = "kv", KEY = "state";
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!("indexedDB" in self)) return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}

async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

export async function load() {
  let raw = null;
  try { raw = await idbGet(KEY); } catch { /* fall back */ }
  if (!raw) { try { raw = JSON.parse(localStorage.getItem("upnext-state") || "null"); } catch { raw = null; } }
  return raw ? normalise(raw) : null;
}

let timer = null, pending = null;
export function save(state) {
  if (state.meta?.demo) return;
  pending = state;
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

export async function flush() {
  if (!pending) return;
  const snapshot = JSON.parse(JSON.stringify(pending));
  pending = null;
  try { await idbSet(KEY, snapshot); }
  catch { try { localStorage.setItem("upnext-state", JSON.stringify(snapshot)); } catch { /* storage full or blocked */ } }
}

export async function wipe() {
  try { await idbSet(KEY, null); } catch { /* ignore */ }
  try { localStorage.removeItem("upnext-state"); } catch { /* ignore */ }
}

// Ask the browser to keep our data even when space runs low (Safari home-screen apps, Chrome installs).
export async function askToPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist(); return true; }
  catch { return false; }
}

addEventListener("pagehide", flush);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
