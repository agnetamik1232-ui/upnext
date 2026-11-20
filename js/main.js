// Up Next — start-up, and one listener for every click, form and input.
import * as W from "./watch.js";
import { app, actions, forms, live, render, closeSheet, isSheetOpen } from "./core.js";
import { todayISO } from "./dates.js";
import { shell } from "./views.js";
import { applyLook, renderUnlock, renderSetup, titleSheet, watchedSheet, yearCard, syncSeries, enrichFilms } from "./flows.js";
import { blankState } from "./model.js";
import { demoState } from "./demo.js";
import * as store from "./store.js";

const params = new URLSearchParams(location.search);
app.demo = params.has("demo");
app.photo = app.demo && params.has("photo");
app.view = "home";

function renderApp() { const y = scrollY; document.getElementById("app").innerHTML = shell(); if (y) scrollTo(0, y); }
app.start = () => { app.renderFn = renderApp; applyLook(); renderApp(); if (app.demo) demoExtras(); else { setTimeout(syncSeries, 1500); setTimeout(enrichFilms, 4000); } };

// Demo only: open a given screen straight away (for listing photos and videos).
//   ?demo&photo  &look=cinema_night  &view=library|night|streaming|stats|settings  &kind=series  &filter=watchlist
//   &open=add | add:<query> | title:<title> | season:<n> | watched:<title> | import | yearcard | svc
function demoExtras() {
  const look = params.get("look"), view = params.get("view"), open = params.get("open") || "";
  if (look) { app.S.profile.look = look; applyLook(); }
  if (view) app.view = view;
  if (params.get("kind")) app.libKind = params.get("kind");
  if (params.get("filter")) app.libFilter = params.get("filter");
  if (look || view || params.get("kind") || params.get("filter")) render();
  const fire = (act, data = {}) => { const el = document.createElement("button"); Object.assign(el.dataset, data); actions[act]?.(el); };
  const byTitle = t => app.S.titles.find(x => x.title.toLowerCase() === t.toLowerCase());
  if (open === "add") fire("add-title");
  if (open.startsWith("add:")) fire("add-title", { q: open.slice(4) });
  if (open.startsWith("title:")) { const t = byTitle(open.slice(6)); if (t) titleSheet(t); }
  if (open.startsWith("watched:")) { const t = byTitle(open.slice(8)); if (t) watchedSheet(t); }
  if (open === "import") fire("import");
  if (open === "svc") fire("svc-edit", { id: "netflix" });
  if (open === "yearcard") yearCard(Number(app.today.slice(0, 4))).then(blob => { document.body.style.margin = "0"; document.body.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="" style="display:block;width:1080px;height:1920px">`; });
}

document.addEventListener("click", e => {
  const scrim = e.target.closest("[data-scrim]");
  if (scrim && e.target === scrim) { closeSheet(); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("submit", e => { const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault(); forms[f.dataset.form]?.(f, e); });
const isChoice = el => el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT";
document.addEventListener("input", e => { const el = e.target.closest("[data-live]"); if (el && !isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-live]"); if (el && isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && isSheetOpen()) closeSheet(); });
function checkDay() { const t = todayISO(); if (t !== app.today) { app.today = t; if (app.renderFn && !isSheetOpen()) render(); if (!app.demo) syncSeries(); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
setInterval(checkDay, 60000);
addEventListener("online", () => { if (app.renderFn && !app.demo) syncSeries(); });

async function boot() {
  app.today = todayISO();
  if (app.demo) { app.S = demoState(app.today); app.start(); return; }
  const s = await store.load();
  app.S = s || blankState();
  applyLook();
  if (!s || !s.meta.unlocked) return renderUnlock();
  if (!s.meta.setupDone) return renderSetup();
  app.start();
}
boot().catch(err => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card"><h1 class="fr" style="color:var(--head)">Something went wrong</h1><p style="margin:.6rem 0 1rem">Your history is safe on this device. Try reloading. If it keeps happening, message the shop with this: ${String(err && err.message || err).replace(/[<>&]/g, "")}</p><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
});
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
