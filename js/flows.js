// Up Next — everything that opens in a sheet, plus unlock, setup, the year card and the background look-ups.
import * as W from "./watch.js";
import { app, actions, forms, live, esc, money, fmtR, fd, fdShort, parseMoney, commit, render, toast, openSheet, updateSheet, closeSheet, sheetHead, shareOrDownload, pickFile, pickFiles, isIOS, isStandalone } from "./core.js";
import { addDays, diffDays, yearOf } from "./dates.js";
import { uid, blankState, newTitle, normalise, STATUSES, FILM_STATUSES, MARKS, MOODS, CURRENCIES, SERVICE_IDEAS, SERVICE_COLORS } from "./model.js";
import { LOOKS } from "./looks.js";
import { poster, stars, ratingText, hm, hours, statusText, svcById, svcColor, personById, genreColor, ICON, LOGO } from "./ui.js";
import { libraryGrid, ETSY_URL, nightState } from "./views.js";
import { searchAll, seriesDetails, findSeries, findFilm } from "./lookup.js";
import { readFiles, plan as importPlan, SOURCE_NAMES } from "./importers.js";
import { DEMO_RESULTS } from "./demo.js";
import * as store from "./store.js";

const S = () => app.S;
const num = v => { const n = parseMoney(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const val = (f, n) => f.elements[n]?.value ?? "";
const byId = id => S().titles.find(t => t.id === id);
const meName = () => S().profile.name || "Me";

// ============ Navigation, looks, filters ============
actions["nav"] = el => { app.view = el.dataset.view; if (el.dataset.filter) { app.libFilter = el.dataset.filter; app.libKind = "all"; } render(); scrollTo({ top: 0 }); };
actions["close-sheet"] = () => closeSheet();
export function applyLook() {
  const P = S()?.profile || {}, h = document.documentElement;
  h.dataset.look = P.look in LOOKS ? P.look : "popcorn";
  P.bigText ? h.setAttribute("data-big", "") : h.removeAttribute("data-big");
  P.easyFont ? h.setAttribute("data-easy", "") : h.removeAttribute("data-easy");
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(h).getPropertyValue("--card").trim() || "#FFFDF8";
}
actions["set-look"] = el => commit(s => { s.profile.look = el.dataset.v; applyLook(); });
actions["set-big"] = () => commit(s => { s.profile.bigText = !s.profile.bigText; applyLook(); });
actions["set-easy"] = () => commit(s => { s.profile.easyFont = !s.profile.easyFont; applyLook(); });
actions["set-spoilers"] = () => commit(s => { s.profile.spoilers = !s.profile.spoilers; });
actions["set-together"] = () => commit(s => { s.profile.together = !s.profile.together; });
actions["lib-filter"] = el => { app.libFilter = el.dataset.v; render(); };
actions["lib-kind"] = el => { app.libKind = el.dataset.v; render(); };
live["lib-q"] = el => { app.libQuery = el.value; const g = document.getElementById("lib-grid"); if (g) g.innerHTML = libraryGrid(); };
live["lib-genre"] = el => { app.libGenre = el.value; render(); };
live["lib-sort"] = el => { app.libSort = el.value; render(); };
live["stats-year"] = el => { app.statsYear = Number(el.value); render(); };
actions["open-title"] = el => { const t = byId(el.dataset.id); if (t) titleSheet(t); };

// ============ Episodes ============
const keyAt = (t, i) => { const e = W.episodes(t)[i]; return e ? W.epKey(e.s, e.e) : null; };
// +1 episode: you, and everyone you watch it with who was on the same episode as you.
actions["ep-next"] = el => {
  const t = byId(el.dataset.id); if (!t) return;
  const nx = W.nextEpisode(t, app.today); if (!nx) return toast("You're all caught up.");
  const before = { seen: { ...t.seen }, at: { ...t.at }, status: t.status, finished: t.finished };
  const me = W.myIndex(t), k = W.epKey(nx.s, nx.e);
  commit(s => {
    const x = s.titles.find(y => y.id === t.id);
    x.seen = { ...x.seen, [k]: app.today };
    if (s.profile.together) for (const pid of x.with || []) if (W.keyIndex(x, (x.at || {})[pid]) === me) x.at = { ...x.at, [pid]: k };
    if (x.status === "watchlist" || x.status === "paused") x.status = "watching";
  });
  const x = byId(t.id), done = W.episodes(x).every(e => W.isSeen(x, e));
  const undo = () => commit(s => Object.assign(s.titles.find(y => y.id === t.id), before));
  if (done) { commit(s => { const y = s.titles.find(z => z.id === t.id); y.status = "watched"; y.finished = app.today; }); toast(`Finished ${x.title}. Rate it?`, undo); setTimeout(() => titleSheet(byId(t.id)), 400); return; }
  const n2 = W.nextEpisode(x, app.today);
  toast(n2 ? `${W.epLabel(x, nx)} watched. Next: ${W.epLabel(x, n2)}` : `${W.epLabel(x, nx)} watched. You're caught up.`, undo);
  if (document.querySelector("#sheet-root .sheet")) redraw();
};
actions["ep-toggle"] = el => {
  const t = byId(ed?.id); if (!t) return;
  const k = el.dataset.k;
  commit(s => { const x = s.titles.find(y => y.id === t.id); const seen = { ...x.seen }; if (seen[k]) delete seen[k]; else seen[k] = app.today; x.seen = seen; if (x.status === "watchlist") x.status = "watching"; });
  redraw();
};
actions["ep-upto"] = el => {
  const t = byId(ed?.id); if (!t) return;
  const idx = Number(el.dataset.i), all = W.episodes(t);
  commit(s => { const x = s.titles.find(y => y.id === t.id); const seen = { ...x.seen }; all.slice(0, idx + 1).forEach(e => { const k = W.epKey(e.s, e.e); if (!seen[k]) seen[k] = "-"; }); x.seen = seen; if (x.status === "watchlist") x.status = "watching"; });
  toast(`Ticked up to ${W.epLabel(t, all[idx])}. Catch-up ticks don't add time to your stats.`);
  redraw();
};
actions["ser-season"] = el => { syncEd(); ed.season = Number(el.dataset.v); redraw(); };
actions["at-step"] = el => {
  const t = byId(ed?.id); if (!t) return;
  const pid = el.dataset.p, d = Number(el.dataset.d), all = W.episodes(t);
  const i = Math.max(-1, Math.min(all.length - 1, W.keyIndex(t, (t.at || {})[pid]) + d));
  commit(s => { const x = s.titles.find(y => y.id === t.id); const at = { ...x.at }; if (i < 0) delete at[pid]; else at[pid] = keyAt(x, i); x.at = at; });
  redraw();
};

// ============ The title page (series and films) ============
let ed = null;
export function titleSheet(t) {
  const nx = t.kind === "series" ? W.nextEpisode(t, app.today) : null;
  ed = { id: t.id, rating: t.rating || 0, ratings: { ...(t.ratings || {}) }, marks: [...(t.marks || [])], moods: [...(t.moods || [])], with: [...(t.with || [])], status: t.status,
    season: nx ? nx.s : (t.seasons || [])[0]?.n || 1, draft: {}, details: false, adding: false };
  drawTitle();
}
function syncEd() {
  const f = document.querySelector('form[data-form="title"]'); if (!f || !ed) return;
  for (const n of ["title", "year", "genre", "runtime", "director", "service", "price", "notes", "wdate"]) if (f.elements[n]) ed.draft[n] = f.elements[n].value;
}
function redraw() { if (!ed || !byId(ed.id)) return; syncEd(); drawTitle(); }
const ratingField = (r, label = "Your rating", key = "") => `<div class="field"><span>${esc(label)} <b class="rating-t" style="margin-left:.4rem">${esc(ratingText(r))}</b></span><div class="rating-row"><span class="rating-stars">${stars(r, 28)}</span><input type="range" min="0" max="5" step="0.25" value="${r}" data-live="rating" data-p="${key}" aria-label="${esc(label)}" class="range"></div></div>`;
function chipPicker(act, base, chosen, icons = {}) {
  const all = [...new Set([...chosen, ...base])];
  return `<div class="chips">${all.map(t => `<button type="button" class="chip pick${chosen.includes(t) ? " on" : ""}" data-act="${act}" data-v="${esc(t)}" aria-pressed="${chosen.includes(t)}">${icons[t] || ""}${esc(t)}</button>`).join("")}<button type="button" class="chip line" data-act="${act}" data-v="+">+ your own</button></div>`;
}
live["rating"] = el => {
  const r = Number(el.value), t = ed || qw; if (!t) return;
  el.dataset.p ? (t.ratings[el.dataset.p] = r) : (t.rating = r);
  const f = el.closest(".field"); f.querySelector(".rating-stars").innerHTML = stars(r, 28); f.querySelector(".rating-t").textContent = ratingText(r);
};
function toggleChip(el, list) {
  let v = el.dataset.v;
  if (v === "+") { v = (prompt("Add your own:") || "").trim().toLowerCase().slice(0, 30); if (!v) return; if (!list.includes(v)) list.push(v); const b = document.createElement("button"); b.type = "button"; b.className = "chip pick on"; b.dataset.act = el.dataset.act; b.dataset.v = v; b.textContent = v; b.setAttribute("aria-pressed", "true"); el.before(b); return; }
  const i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v);
  el.classList.toggle("on", i < 0); el.setAttribute("aria-pressed", String(i < 0));
}
actions["ed-mark"] = el => toggleChip(el, ed.marks);
actions["ed-mood"] = el => toggleChip(el, ed.moods);
actions["ed-with"] = el => { syncEd(); const i = ed.with.indexOf(el.dataset.v); i >= 0 ? ed.with.splice(i, 1) : ed.with.push(el.dataset.v); redraw(); };
actions["ed-status"] = el => { syncEd(); ed.status = el.dataset.v; redraw(); };
actions["ed-details"] = () => { syncEd(); ed.details = !ed.details; redraw(); };
const MARK_ICONS = { "comfort watch": ICON.heart, "made me cry": ICON.drop };

function episodesBlock(t) {
  const all = W.episodes(t);
  if (!all.length) return `<div class="field"><span>Episodes</span><div class="empty">${t.tvmaze ? "No episodes listed yet." : "No episode list yet."} <button type="button" class="btn text small" data-act="ser-find">${t.tvmaze ? "Check again" : "Find episodes online"}</button> or <button type="button" class="btn text small" data-act="ser-manual">add seasons yourself</button></div></div>`;
  const seasons = [...new Set(all.map(e => e.s))], s = seasons.includes(ed.season) ? ed.season : seasons[0];
  const nx = W.nextEpisode(t, app.today), spoil = S().profile.spoilers;
  const rows = all.map((e, i) => ({ e, i })).filter(x => x.e.s === s).map(({ e, i }) => {
    const seen = W.isSeen(t, e), d = (t.seen || {})[W.epKey(e.s, e.e)], isNext = nx && nx.s === e.s && nx.e === e.e, out = !W.aired(e, app.today);
    const name = seen || spoil ? e.title || "" : e.title ? "Title hidden until you watch" : "";
    return `<div class="ep${isNext ? " next" : ""}${out ? " future" : ""}"><button type="button" class="box${seen ? " on" : ""}" data-act="ep-toggle" data-k="${W.epKey(e.s, e.e)}" aria-pressed="${seen}" aria-label="Episode ${e.e} watched"${out && !seen ? " disabled" : ""}>${seen ? ICON.tick : ""}</button>
      <div class="t"><b>Episode ${e.e}</b><small>${esc(name)}${name && (e.runtime || t.runtime) ? " · " : ""}${e.runtime || t.runtime ? hm(e.runtime || t.runtime) : ""}</small></div>
      <div class="r">${seen ? (d && d !== "-" ? esc(fdShort(d)) : "seen") : isNext ? "UP NEXT" : out ? `airs ${esc(fdShort(e.airdate))}` : `<button type="button" class="btn text small" data-act="ep-upto" data-i="${i}">seen up to here</button>`}</div></div>`;
  }).join("");
  const sp = W.progress(t, app.today);
  return `<div class="field"><span>Episodes <small class="muted" style="display:inline;margin-left:.4rem">${sp.seen} of ${sp.total} seen</small></span>
    ${seasons.length > 1 ? `<div class="seg" style="margin-bottom:.5rem">${seasons.map(n => `<button type="button" data-act="ser-season" data-v="${n}" aria-pressed="${n === s}">Season ${n}</button>`).join("")}</div>` : ""}
    <div class="eps">${rows}</div>${t.tvmaze ? `<p class="small muted" style="margin-top:.5rem">Episode list from <a href="${esc(t.link || "https://www.tvmaze.com")}" target="_blank" rel="noopener">TVmaze</a>. <button type="button" class="btn text small" data-act="ser-find">Refresh</button></p>` : ""}</div>`;
}
function togetherBlock(t) {
  if (!S().profile.together || !S().people.length) return "";
  const tg = W.together(t, S().people.filter(p => ed.with.includes(p.id)), app.today), all = W.episodes(t);
  const label = i => (i >= 0 ? W.epLabel(t, all[i]) : "not started");
  const pct = i => (all.length ? ((i + 1) / all.length) * 100 : 0).toFixed(1);
  return `<div class="together"><div class="caps">Watching together</div>
    <div class="chips" style="margin:.4rem 0 .6rem">${S().people.map(p => `<button type="button" class="chip pick${ed.with.includes(p.id) ? " on" : ""}" data-act="ed-with" data-v="${p.id}" aria-pressed="${ed.with.includes(p.id)}">${ICON.people} ${esc(p.name)}</button>`).join("")}</div>
    ${ed.with.length && all.length ? `<div class="who"><b>${esc(meName())}</b><div class="bar"><i style="width:${pct(tg.me)}%"></i></div><span>${label(tg.me)}</span><span></span><span></span></div>
      ${tg.rows.map(r => `<div class="who"><b>${esc(r.person.name)}</b><div class="bar"><i style="width:${pct(r.idx)}%;background:var(--head)"></i></div><span>${label(r.idx)}</span><button type="button" class="step" data-act="at-step" data-p="${r.person.id}" data-d="-1" aria-label="${esc(r.person.name)} one back">&minus;</button><button type="button" class="step" data-act="at-step" data-p="${r.person.id}" data-d="1" aria-label="${esc(r.person.name)} one more">+</button></div>`).join("")}
      ${tg.note ? `<p class="tg-note">${esc(tg.note)}</p>` : ""}` : `<p class="small muted">Pick who you watch this with to keep everyone's place.</p>`}</div>`;
}
function filmWatches(t) {
  const w = t.watches || [];
  return `<div class="field"><span>Watched</span>${w.length ? `<div class="watches">${w.map((x, i) => `<div class="wrow"><b>${x.date ? esc(fd(x.date)) : "date unknown"}</b><small>${(x.with || []).map(p => esc(personById(p)?.name || "")).filter(Boolean).join(", ") ? `with ${(x.with || []).map(p => esc(personById(p)?.name || "")).filter(Boolean).join(", ")}` : ""}</small><button type="button" class="x" data-act="watch-del" data-i="${i}" aria-label="Remove this watch">&times;</button></div>`).join("")}</div>` : `<p class="small muted">Not yet.</p>`}
    ${ed.adding ? `<div class="row2" style="margin-top:.5rem"><input class="input" type="date" name="wdate" value="${esc(ed.draft.wdate || app.today)}" max="${app.today}"><button type="button" class="btn primary" data-act="watch-add-go">Add this watch</button></div>` : `<button type="button" class="btn soft small" data-act="watch-add" style="margin-top:.4rem">${w.length ? "+ Watched it again" : "+ I watched it"}</button>`}</div>`;
}
actions["watch-add"] = () => { syncEd(); ed.adding = true; redraw(); };
actions["watch-add-go"] = () => {
  syncEd(); const d = ed.draft.wdate || app.today;
  commit(s => { const x = s.titles.find(y => y.id === ed.id); x.watches = [...(x.watches || []), { date: d, with: [...ed.with] }].sort((a, b) => (a.date || "").localeCompare(b.date || "")); x.status = "watched"; if (x.watches.length > 1 && !x.marks.includes("rewatch")) x.marks.push("rewatch"); });
  ed.adding = false; ed.status = "watched"; if (byId(ed.id).marks.includes("rewatch") && !ed.marks.includes("rewatch")) ed.marks.push("rewatch"); redraw();
};
actions["watch-del"] = el => { syncEd(); commit(s => { const x = s.titles.find(y => y.id === ed.id); x.watches = x.watches.filter((_, i) => i !== Number(el.dataset.i)); if (!x.watches.length && x.status === "watched") x.status = "watchlist"; }); ed.status = byId(ed.id).status; redraw(); };

function drawTitle() {
  const t0 = byId(ed.id); if (!t0) return;
  const t = { ...t0, ...Object.fromEntries(Object.entries(ed.draft).filter(([k]) => ["title", "year", "genre", "runtime", "director"].includes(k))) };
  const d = k => (ed.draft[k] ?? t0[k] ?? "");
  const series = t.kind === "series", sts = series ? STATUSES : FILM_STATUSES;
  const meta = [t.year, series ? `${(t.seasons || []).length || "?"} ${(t.seasons || []).length === 1 ? "season" : "seasons"}` : t.runtime ? `${t.runtime} min` : "", t.genre, series ? t.network : t.director ? `directed by ${t.director}` : ""].filter(Boolean).join(" · ");
  const others = S().people.filter(p => ed.with.includes(p.id));
  const html = `${sheetHead(esc(t.title) || "Title")}
  <form data-form="title" data-id="${t.id}">
    <div class="tp-top"><div class="tp-poster">${poster(t, 120)}<button type="button" class="btn text small" data-act="pic-add">${t0.picture ? "Change picture" : "Add your own picture"}</button></div><div style="flex:1;min-width:0">
      <p class="tp-meta">${esc(meta)}</p>
      <div class="seg" style="margin:.2rem 0 .9rem">${sts.map(([k, l]) => `<button type="button" data-act="ed-status" data-v="${k}" aria-pressed="${ed.status === k}">${l}</button>`).join("")}</div>
      ${ratingField(ed.rating, `${meName()}'s rating`)}
      ${others.map(p => ratingField(ed.ratings[p.id] || 0, `${p.name}'s rating`, p.id)).join("")}
    </div></div>
    ${series ? togetherBlock(t0) + episodesBlock(t0) : filmWatches(t0) + (S().profile.together && S().people.length ? `<div class="field"><span>Watched with</span><div class="chips">${S().people.map(p => `<button type="button" class="chip pick${ed.with.includes(p.id) ? " on" : ""}" data-act="ed-with" data-v="${p.id}" aria-pressed="${ed.with.includes(p.id)}">${ICON.people} ${esc(p.name)}</button>`).join("")}</div></div>` : "")}
    <div class="field"><span>Marks</span>${chipPicker("ed-mark", MARKS, ed.marks, MARK_ICONS)}</div>
    <div class="field"><span>Mood</span>${chipPicker("ed-mood", MOODS, ed.moods)}</div>
    <div class="row2"><label class="field"><span>Where you watch it</span><select class="input" name="service"><option value="">Not set</option>${S().services.map(s => `<option value="${s.id}"${s.id === d("service") ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select><small><button type="button" class="btn text small" data-act="svc-edit" style="padding:0;min-height:0">Add a service</button></small></label>
      ${series ? "" : `<label class="field"><span>Paid to watch it</span><input class="input" name="price" inputmode="decimal" value="${esc(d("price") ?? "")}" placeholder="cinema, rental"></label>`}</div>
    <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="3" placeholder="What you thought, who recommended it, a scene you loved">${esc(d("notes"))}</textarea></label>
    <button type="button" class="btn text small" data-act="ed-details">${ed.details ? "Hide details" : "Edit details (title, year, genre, length)"}</button>
    ${ed.details ? `<div class="details"><label class="field"><span>Title</span><input class="input" name="title" value="${esc(d("title"))}" required></label>
      <div class="row3"><label class="field"><span>Genre</span><select class="input" name="genre">${S().genres.map(g => `<option${g === d("genre") ? " selected" : ""}>${esc(g)}</option>`).join("")}</select></label>
      <label class="field"><span>Year</span><input class="input" name="year" inputmode="numeric" value="${esc(d("year") ?? "")}"></label>
      <label class="field"><span>${series ? "Minutes an episode" : "Minutes"}</span><input class="input" name="runtime" inputmode="numeric" value="${esc(d("runtime") ?? "")}"></label></div>
      ${series ? "" : `<label class="field"><span>Director</span><input class="input" name="director" value="${esc(d("director"))}"></label>`}
      ${!series && !t0.wikidata && !app.demo ? `<button type="button" class="btn soft small" data-act="film-lookup">Look up details online</button>` : ""}</div>` : ""}
    <button class="btn primary full" type="submit" style="margin-top:1rem">Save</button>
    <div class="row-btns" style="justify-content:center;margin-top:.6rem"><button type="button" class="btn text small" data-act="title-del">Delete from my library</button></div>
  </form>`;
  document.querySelector("#sheet-root .sheet") ? updateSheet(html) : openSheet(html, { wide: true, label: t.title, onClose: () => { ed = null; } });
}
forms["title"] = f => {
  syncEd();
  const t = byId(ed.id); if (!t) return;
  const dr = ed.draft;
  commit(s => {
    const x = s.titles.find(y => y.id === t.id);
    Object.assign(x, { rating: ed.rating, ratings: Object.fromEntries(Object.entries(ed.ratings).filter(([, r]) => r > 0)), marks: ed.marks, moods: ed.moods, with: ed.with, status: ed.status,
      service: dr.service ?? x.service, notes: (dr.notes ?? x.notes).trim() });
    if ("price" in dr) x.price = num(dr.price);
    if (dr.title?.trim()) x.title = dr.title.trim();
    if ("genre" in dr) x.genre = dr.genre;
    if ("year" in dr) x.year = Number(dr.year) || null;
    if ("runtime" in dr) x.runtime = Number(dr.runtime) || null;
    if ("director" in dr) x.director = dr.director.trim();
    if (x.kind === "film" && x.status === "watched" && !x.watches.length) x.watches = [{ date: app.today, with: [...x.with] }];
    if (x.kind === "series" && x.status === "watched" && !x.finished) x.finished = app.today;
  });
  closeSheet(); toast("Saved.");
};
actions["title-del"] = () => {
  const t = byId(ed.id); if (!t) return;
  const copy = JSON.parse(JSON.stringify(t)), i = S().titles.indexOf(t);
  commit(s => { s.titles = s.titles.filter(x => x.id !== t.id); }); closeSheet();
  toast(`${t.title} deleted.`, () => commit(s => { s.titles.splice(i, 0, copy); }));
};

// Your own picture (a photo of the cinema ticket, the DVD cover...), shrunk and kept on this device.
actions["pic-add"] = () => {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.style.display = "none";
  i.onchange = () => {
    const f = i.files && i.files[0]; i.remove(); if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const w = 300, h = 450, c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"), k = Math.max(w / img.width, h / img.height);
      x.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
      const data = c.toDataURL("image/jpeg", 0.82); URL.revokeObjectURL(url);
      syncEd(); commit(s => { s.titles.find(y => y.id === ed.id).picture = data; }); redraw();
    };
    img.src = url;
  };
  document.body.appendChild(i); i.click();
};

// Episode lists: from TVmaze, or seasons you type in yourself.
actions["ser-find"] = async () => {
  const t = byId(ed?.id); if (!t) return;
  if (app.demo) return toast("In the demo the episode lists are made up, so there's nothing to look up.");
  toast("Looking up episodes…");
  try {
    let id = t.tvmaze;
    if (!id) { const f = await findSeries(t.title, t.year); if (!f) return toast("Couldn't find it on TVmaze. Add seasons yourself instead."); id = f.tvmaze; }
    const dt = await seriesDetails(id); if (!dt) return toast("Couldn't find it on TVmaze.");
    commit(s => mergeSeries(s.titles.find(y => y.id === t.id), dt));
    syncEd(); ed.season = W.nextEpisode(byId(t.id), app.today)?.s || ed.season; redraw(); toast(`${dt.seasons.length} ${dt.seasons.length === 1 ? "season" : "seasons"} found.`);
  } catch { toast("Couldn't reach TVmaze. Check your internet and try again."); }
};
export function mergeSeries(x, dt) {
  Object.assign(x, { tvmaze: dt.tvmaze, link: dt.link || x.link, seasons: dt.seasons.length ? dt.seasons : x.seasons, poster: dt.poster || x.poster, network: x.network || dt.network,
    runtime: x.runtime || dt.runtime, imdb: x.imdb || dt.imdb, year: x.year || dt.year, synced: app.today });
}
actions["ser-manual"] = () => {
  syncEd();
  const t = byId(ed.id);
  openSheet(`${sheetHead("Seasons and episodes", "Back")}<form data-form="ser-manual"><p class="small muted" style="margin-bottom:.8rem">Type how many episodes each season has, separated by commas. For example: 8, 8, 10</p>
    <label class="field"><span>Episodes per season</span><input class="input" name="eps" value="${(t.seasons || []).map(s => s.episodes.length).join(", ")}" placeholder="8, 8, 10" autofocus></label>
    <label class="field"><span>Minutes an episode</span><input class="input" name="rt" inputmode="numeric" value="${t.runtime || ""}"></label><button class="btn primary full" type="submit">Save</button></form>`, { label: "Seasons", onClose: () => titleSheet(byId(t.id)) });
};
forms["ser-manual"] = f => {
  const counts = val(f, "eps").split(/[,;\s]+/).map(Number).filter(n => n > 0 && n < 500);
  const id = ed.id;
  commit(s => { const x = s.titles.find(y => y.id === id); x.seasons = counts.map((c, i) => ({ n: i + 1, episodes: Array.from({ length: c }, (_, k) => ({ n: k + 1, title: "", airdate: null, runtime: null })) })); x.runtime = Number(val(f, "rt")) || x.runtime; });
  closeSheet();
};
actions["film-lookup"] = async () => {
  syncEd(); const t = byId(ed.id); toast("Looking it up…");
  try {
    const r = await findFilm(ed.draft.title || t.title, Number(ed.draft.year) || t.year);
    if (!r) return toast("Couldn't find it. You can type the details in yourself.");
    commit(s => { const x = s.titles.find(y => y.id === t.id); Object.assign(x, { wikidata: r.wikidata, imdb: x.imdb || r.imdb, year: x.year || r.year, runtime: x.runtime || r.runtime, director: x.director || r.director, genre: x.genre === "Other" ? r.genre : x.genre }); });
    ed.draft = {}; redraw(); toast("Details filled in.");
  } catch { toast("Couldn't reach Wikidata. Check your internet."); }
};

// ============ Adding a title: search or type ============
let add = null;
actions["add-title"] = el => { add = { q: el.dataset.q || "", results: null, busy: false, manual: false }; drawAdd(); if (add.q) forms["add-search"](null); };
function drawAdd() {
  const html = `${sheetHead("Add a film or series", "Close")}
    <form data-form="add-search" class="searchrow"><input class="input" name="q" value="${esc(add.q)}" placeholder="Title, e.g. Gilmore Girls or Little Women" autofocus autocomplete="off" enterkeyhint="search"><button class="btn primary" type="submit">Search</button></form>
    ${add.busy ? `<div class="empty">Searching&hellip;</div>` : add.results ? resultsHTML() : `<p class="small muted" style="margin:.6rem 0 0">Series come with their episode list and air dates. Films get their year, length and director.</p>`}
    <div style="margin-top:1rem">${add.manual ? manualForm() : `<button type="button" class="btn text small" data-act="add-manual">Can't find it? Type it in yourself</button>`}</div>`;
  document.querySelector("#sheet-root .sheet") && document.querySelector('#sheet-root form[data-form="add-search"]') ? updateSheet(html) : openSheet(html, { wide: true, label: "Add" });
}
function resultsHTML() {
  if (!add.results.length) return `<div class="empty">${add.offline ? "You seem to be offline. Searching needs internet; you can type a title in yourself." : `Nothing found for "${esc(add.q)}". Try fewer words, or type it in yourself.`}</div>`;
  return `<div class="results">${add.results.map((r, i) => {
    const mine = W.findTitle(S(), r);
    return `<button type="button" class="result" data-act="pick-result" data-i="${i}">${poster({ ...r, genre: r.genre || "Other" }, 46)}<span><b>${esc(r.title)}</b><small>${r.kind === "series" ? "Series" : "Film"}${r.year ? ` · ${r.year}` : ""}${r.kind === "series" ? (r.network ? ` · ${esc(r.network)}` : "") : r.director ? ` · ${esc(r.director)}` : ""}${r.runtime ? ` · ${r.runtime} min` : ""}</small>${mine ? `<em>In your library: ${esc(statusText(mine))}</em>` : ""}</span></button>`;
  }).join("")}</div>`;
}
forms["add-search"] = async f => {
  if (f) add.q = val(f, "q").trim();
  if (!add.q) return;
  add.busy = true; add.results = null; drawAdd();
  if (app.demo) { await new Promise(r => setTimeout(r, 300)); add.results = [...DEMO_RESULTS]; add.busy = false; drawAdd(); return; }
  try { const r = await searchAll(add.q); add.results = r.results; add.offline = r.offline; } catch { add.results = []; add.offline = !navigator.onLine; }
  add.busy = false; drawAdd();
};
actions["add-manual"] = () => { add.manual = true; drawAdd(); };
function manualForm() {
  return `<form data-form="add-manual" class="card" style="padding:1rem"><div class="seg" style="margin-bottom:.7rem">${[["film", "Film"], ["series", "Series"]].map(([k, l]) => `<label class="radio"><input type="radio" name="kind" value="${k}"${k === "film" ? " checked" : ""}> ${l}</label>`).join("")}</div>
    <label class="field"><span>Title</span><input class="input" name="title" value="${esc(add.q)}" required></label>
    <div class="row3"><label class="field"><span>Genre</span><select class="input" name="genre">${S().genres.map(g => `<option>${esc(g)}</option>`).join("")}</select></label><label class="field"><span>Year</span><input class="input" name="year" inputmode="numeric"></label><label class="field"><span>Minutes</span><input class="input" name="runtime" inputmode="numeric"></label></div>
    <label class="field"><span>Series only: episodes per season</span><input class="input" name="eps" placeholder="8, 8, 10"></label><button class="btn primary full" type="submit">Next</button></form>`;
}
forms["add-manual"] = f => {
  const kind = f.elements.kind.value, title = val(f, "title").trim(); if (!title) return;
  const counts = val(f, "eps").split(/[,;\s]+/).map(Number).filter(n => n > 0 && n < 500);
  confirmAdd({ kind, title, year: Number(val(f, "year")) || null, genre: val(f, "genre"), runtime: Number(val(f, "runtime")) || null,
    seasons: kind === "series" ? counts.map((c, i) => ({ n: i + 1, episodes: Array.from({ length: c }, (_, k) => ({ n: k + 1, title: "", airdate: null, runtime: null })) })) : [] });
};
actions["pick-result"] = async el => {
  const r = add.results[Number(el.dataset.i)]; if (!r) return;
  const mine = W.findTitle(S(), r); if (mine) { closeSheet(); return titleSheet(mine); }
  if (r.kind === "series" && r.tvmaze && !app.demo) {
    updateSheet(`${sheetHead(esc(r.title), "Close")}<div class="empty">Getting the episode list&hellip;</div>`);
    try { const dt = await seriesDetails(r.tvmaze); return confirmAdd(dt || r); } catch { return confirmAdd(r); }
  }
  if (r.kind === "series" && app.demo) return confirmAdd({ ...r, seasons: [{ n: 1, episodes: Array.from({ length: 6 }, (_, k) => ({ n: k + 1, title: "", airdate: addDays(app.today, -60 + k * 7), runtime: 40 })) }] });
  confirmAdd(r);
};
let pend = null;
function confirmAdd(r) {
  pend = { ...r, status: r.kind === "series" ? "watching" : "watchlist", with: S().profile.together && S().people.length ? [S().people[0].id] : [], service: "" };
  drawConfirm();
}
function drawConfirm() {
  const r = pend, sts = r.kind === "series" ? [["watching", "Watching"], ["watchlist", "Watchlist"], ["watched", "Watched it all"]] : [["watchlist", "Watchlist"], ["watched", "I've seen it"]];
  const n = (r.seasons || []).reduce((t, s) => t + s.episodes.length, 0);
  updateSheet(`${sheetHead(esc(r.title), "Cancel")}
    <div class="tp-top">${poster({ ...r, genre: r.genre || "Other" }, 100)}<div style="flex:1"><p class="tp-meta">${[r.kind === "series" ? "Series" : "Film", r.year, r.kind === "series" ? (n ? `${(r.seasons || []).length} ${(r.seasons || []).length === 1 ? "season" : "seasons"} · ${n} episodes` : "") : r.runtime ? `${r.runtime} min` : "", r.kind === "series" ? r.network : r.director].filter(Boolean).map(esc).join(" · ")}</p>
      <div class="seg">${sts.map(([k, l]) => `<button type="button" data-act="pend-status" data-v="${k}" aria-pressed="${r.status === k}">${l}</button>`).join("")}</div></div></div>
    ${S().services.length ? `<div class="field"><span>Where you'll watch it</span><div class="chips">${S().services.map(s => `<button type="button" class="chip pick${r.service === s.id ? " on" : ""}" data-act="pend-svc" data-v="${s.id}" aria-pressed="${r.service === s.id}">${esc(s.name)}</button>`).join("")}</div></div>` : ""}
    ${S().profile.together && S().people.length ? `<div class="field"><span>Watching with</span><div class="chips">${S().people.map(p => `<button type="button" class="chip pick${r.with.includes(p.id) ? " on" : ""}" data-act="pend-with" data-v="${p.id}" aria-pressed="${r.with.includes(p.id)}">${ICON.people} ${esc(p.name)}</button>`).join("")}</div></div>` : ""}
    <button type="button" class="btn primary full" data-act="pend-save">Add to my library</button>`);
}
actions["pend-status"] = el => { pend.status = el.dataset.v; drawConfirm(); };
actions["pend-svc"] = el => { pend.service = pend.service === el.dataset.v ? "" : el.dataset.v; drawConfirm(); };
actions["pend-with"] = el => { const i = pend.with.indexOf(el.dataset.v); i >= 0 ? pend.with.splice(i, 1) : pend.with.push(el.dataset.v); drawConfirm(); };
actions["pend-save"] = () => {
  const r = pend, t = newTitle({ kind: r.kind, title: r.title, year: r.year || null, genre: S().genres.includes(r.genre) ? r.genre : "Other", runtime: r.runtime || null, director: r.director || "",
    network: r.network || "", poster: r.poster || "", tvmaze: r.tvmaze || null, wikidata: r.wikidata || "", imdb: r.imdb || "", link: r.link || "", seasons: r.seasons || [],
    status: r.status, service: r.service, with: r.with, synced: r.tvmaze ? app.today : null, addedAt: app.today });
  if (t.kind === "series" && r.status === "watched") { t.seen = Object.fromEntries(W.episodes(t).filter(e => W.aired(e, app.today)).map(e => [W.epKey(e.s, e.e), "-"])); t.finished = app.today; }
  commit(s => s.titles.unshift(t));
  closeSheet();
  if (t.kind === "film" && r.status === "watched") return watchedSheet(byId(t.id));
  toast(r.status === "watchlist" ? `${t.title} is on your watchlist.` : `${t.title} added.`);
  if (t.kind === "series" && r.status === "watching") setTimeout(() => titleSheet(byId(t.id)), 250);
};

// ============ "We watched it" (films) ============
let qw = null;
export function watchedSheet(t) {
  qw = { id: t.id, rating: t.rating || 0, ratings: { ...(t.ratings || {}) }, with: [...(nightState().who || []).filter(p => p !== "me" && personById(p))], marks: [...(t.marks || [])] };
  if (!S().profile.together) qw.with = [];
  drawWatched();
}
function drawWatched() {
  const t = byId(qw.id);
  openSheet(`${sheetHead(`Watched <em class="it">${esc(t.title)}</em>`, "Later")}
    <form data-form="watched"><div class="tp-top">${poster(t, 80)}<p class="small muted" style="font-weight:700">Two taps to remember how it felt, or just save.</p></div>
    ${ratingField(qw.rating, `${meName()}'s rating`)}
    ${S().people.filter(p => qw.with.includes(p.id)).map(p => ratingField(qw.ratings[p.id] || 0, `${p.name}'s rating`, p.id)).join("")}
    ${S().profile.together && S().people.length ? `<div class="field"><span>Watched with</span><div class="chips">${S().people.map(p => `<button type="button" class="chip pick${qw.with.includes(p.id) ? " on" : ""}" data-act="qw-with" data-v="${p.id}" aria-pressed="${qw.with.includes(p.id)}">${ICON.people} ${esc(p.name)}</button>`).join("")}</div></div>` : ""}
    <div class="field"><span>Marks</span>${chipPicker("qw-mark", MARKS.slice(0, 5), qw.marks, MARK_ICONS)}</div>
    <label class="field"><span>Watched on</span><input class="input" type="date" name="date" value="${app.today}" max="${app.today}"></label>
    <button class="btn primary full" type="submit">Save</button></form>`, { label: "Watched", onClose: () => { qw = null; } });
}
actions["qw-with"] = el => { const i = qw.with.indexOf(el.dataset.v); i >= 0 ? qw.with.splice(i, 1) : qw.with.push(el.dataset.v); const r = qw.rating; drawWatched(); qw.rating = r; };
actions["qw-mark"] = el => toggleChip(el, qw.marks);
const _rating = live["rating"];
live["rating"] = el => { if (document.querySelector('form[data-form="watched"]')) { const r = Number(el.value); el.dataset.p ? (qw.ratings[el.dataset.p] = r) : (qw.rating = r); const f = el.closest(".field"); f.querySelector(".rating-stars").innerHTML = stars(r, 28); f.querySelector(".rating-t").textContent = ratingText(r); return; } _rating(el); };
forms["watched"] = f => {
  const date = val(f, "date") || app.today, id = qw.id;
  commit(s => {
    const x = s.titles.find(y => y.id === id);
    x.watches = [...(x.watches || []), { date, with: [...qw.with] }].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    Object.assign(x, { status: "watched", rating: qw.rating || x.rating, ratings: { ...x.ratings, ...Object.fromEntries(Object.entries(qw.ratings).filter(([, r]) => r > 0)) }, marks: qw.marks, with: [...new Set([...(x.with || []), ...qw.with])] });
    if (x.watches.length > 1 && !x.marks.includes("rewatch")) x.marks.push("rewatch");
  });
  closeSheet(); if (app.night) app.night.pick = null;
  toast("Saved. Enjoy the credits.");
};

// ============ Movie night ============
const flipList = (list, v) => { const i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v); };
actions["night-time"] = el => { const n = nightState(); n.minutes = Number(el.dataset.v); n.pick = null; n.skip = []; render(); };
actions["night-mood"] = el => { const n = nightState(); flipList(n.moods, el.dataset.v); n.pick = null; n.skip = []; render(); };
actions["night-scary"] = () => { const n = nightState(); n.noScary = !n.noScary; n.pick = null; render(); };
actions["night-comfort"] = () => { const n = nightState(); n.comfort = !n.comfort; n.pick = null; render(); };
actions["night-who"] = el => { const n = nightState(); flipList(n.who, el.dataset.v); render(); };
actions["night-again"] = () => {
  const n = nightState(); if (n.pick && !n.skip.includes(n.pick)) n.skip.push(n.pick);
  let res = W.movieNight(S(), n, app.today);
  if (res.count > 1 && (!res.pick || res.pick.id === n.pick || n.skip.length >= res.count)) { n.skip = n.pick ? [n.pick] : []; res = W.movieNight(S(), n, app.today); }
  n.pick = res.pick?.id || null;
  render();
};
actions["night-watch"] = el => { const t = byId(el.dataset.id); if (t) watchedSheet(t); };

// ============ Streaming services ============
let svcDraft = null;
actions["svc-edit"] = el => {
  syncEd();
  const s = svcById(el.dataset.id);
  svcDraft = s ? { ...s } : { id: uid(), name: "", price: "", cycle: "month", color: S().services.length % SERVICE_COLORS, paused: false, isNew: true };
  const back = ed && document.querySelector('#sheet-root form[data-form="title"]') ? ed.id : null;
  openSheet(`${sheetHead(s ? esc(s.name) : "Add a service", "Cancel")}<form data-form="svc">
    <label class="field"><span>Name</span><input class="input" name="name" value="${esc(svcDraft.name)}" list="svc-ideas" required autofocus></label>
    <datalist id="svc-ideas">${SERVICE_IDEAS.map(x => `<option value="${esc(x)}">`).join("")}</datalist>
    <div class="row2"><label class="field"><span>Price</span><input class="input" name="price" inputmode="decimal" value="${esc(svcDraft.price ?? "")}" placeholder="0 if free"></label>
    <label class="field"><span>Every</span><select class="input" name="cycle"><option value="month"${svcDraft.cycle === "month" ? " selected" : ""}>month</option><option value="year"${svcDraft.cycle === "year" ? " selected" : ""}>year</option></select></label></div>
    <label class="check"><input type="checkbox" name="paused"${svcDraft.paused ? " checked" : ""}> Paused or cancelled for now</label>
    <button class="btn primary full" type="submit">Save</button>${s ? `<div class="row-btns" style="justify-content:center;margin-top:.6rem"><button type="button" class="btn text small" data-act="svc-del" data-id="${s.id}">Delete this service</button></div>` : ""}</form>`,
    { label: "Service", onClose: back ? () => { const t = byId(back); if (t) { const keep = ed; titleSheet(t); if (keep) { ed.draft = keep.draft; ed.rating = keep.rating; ed.marks = keep.marks; ed.moods = keep.moods; ed.with = keep.with; ed.status = keep.status; drawTitle(); } } } : null });
};
forms["svc"] = f => {
  const d = { ...svcDraft, name: val(f, "name").trim().slice(0, 30), price: num(val(f, "price")) || 0, cycle: val(f, "cycle"), paused: f.elements.paused.checked };
  if (!d.name) return;
  delete d.isNew;
  commit(s => { const i = s.services.findIndex(x => x.id === d.id); i >= 0 ? (s.services[i] = d) : s.services.push(d); });
  closeSheet(); toast(`${d.name} saved.`);
};
actions["svc-del"] = el => { const id = el.dataset.id; commit(s => { s.services = s.services.filter(x => x.id !== id); s.titles.forEach(t => { if (t.service === id) t.service = ""; }); }); closeSheet(); };
actions["svc-pause"] = el => { commit(s => { s.services.find(x => x.id === el.dataset.id).paused = true; }); toast("Marked as paused. Turn it back on in the service when you restart it."); };
actions["svc-keep"] = el => { commit(s => { s.services.find(x => x.id === el.dataset.id).snooze = app.today; }); toast("Okay, no more reminders about it for two months."); };

// ============ People ============
actions["person-add"] = () => openSheet(`${sheetHead("Someone you watch with", "Cancel")}<form data-form="person"><label class="field"><span>Their name</span><input class="input" name="name" autofocus required placeholder="e.g. Benas"></label><p class="small muted" style="margin-bottom:1rem">Up Next keeps their place in shows you watch together, and their ratings next to yours.</p><button class="btn primary full" type="submit">Add</button></form>`, { label: "Person" });
forms["person"] = f => { const name = val(f, "name").trim().slice(0, 24); if (!name) return; commit(s => s.people.push({ id: uid(), name })); closeSheet(); };
actions["person-del"] = el => { const p = personById(el.dataset.id); if (!p || !confirm(`Remove ${p.name}? Their ratings and places in shows go too.`)) return; commit(s => { s.people = s.people.filter(x => x.id !== p.id); s.titles.forEach(t => { t.with = (t.with || []).filter(x => x !== p.id); delete (t.at || {})[p.id]; delete (t.ratings || {})[p.id]; }); }); };

// ============ Your year on screen (a story card picture) ============
actions["year-card"] = async el => {
  const Y = Number(el.dataset.year) || yearOf(app.today);
  openSheet(`${sheetHead("Your year on screen")}<div class="empty">Making your card&hellip;</div>`, { label: "Year card" });
  const blob = await yearCard(Y), url = URL.createObjectURL(blob);
  updateSheet(`${sheetHead("Your year on screen")}<img src="${url}" alt="Your ${Y} on screen" class="yc"><div class="row-btns" style="margin-top:1rem;justify-content:center"><button type="button" class="btn primary" data-act="year-save">Save or share</button></div><p class="small muted" style="margin-top:.5rem;text-align:center">Made for Instagram and TikTok stories (1080 × 1920).</p>`);
  actions["year-save"] = async () => {
    const file = new File([blob], `my-${Y}-on-screen.png`, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
};
export async function yearCard(Y) {
  const st = W.yearStats(S(), Y);
  const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue("--" + n).trim();
  const dark = LOOKS[S().profile.look]?.dark, bg = dark ? v("card") : v("head"), fg = dark ? v("ink") : v("bg"), gold = v("gold") || "#F2C14E";
  const gcol = g => css.getPropertyValue(genreColor(g).slice(4, -1)).trim() || "#7B3A4B";
  try { await Promise.all(["800 90px Fraunces", "italic 800 90px Fraunces", "800 30px Nunito", "700 40px 'Dancing Script'"].map(f => document.fonts.load(f))); } catch { /* fonts optional */ }
  const W0 = 1080, H = 1920, c = document.createElement("canvas"); c.width = W0; c.height = H;
  const x = c.getContext("2d"), P = 90;
  x.fillStyle = bg; x.fillRect(0, 0, W0, H);
  for (let i = 0; i < 18; i++) { x.fillStyle = gold; x.globalAlpha = .55; x.fillRect(i * 60 + 6, 0, 30, 46); } x.globalAlpha = 1;
  x.textBaseline = "top"; x.fillStyle = gold; x.font = "800 30px Nunito";
  const name = S().profile.name;
  x.fillText(`${name ? name.toUpperCase() + "'S" : "MY"} ${Y} ON SCREEN`.split("").join(String.fromCharCode(8202)), P, 170);
  x.fillStyle = fg; x.font = "800 104px Fraunces"; x.fillText(`${st.films} ${st.films === 1 ? "film" : "films"},`, P, 230);
  x.fillStyle = gold; x.font = "italic 800 104px Fraunces"; x.fillText(`${st.episodes} episodes.`, P, 348);
  const cells = [[`${st.hours} h`, "on screen"], [st.topGenre || "–", "top genre"], [st.avgRating != null ? String(st.avgRating) : "–", "average rating"], [String(st.loved), "films rated 4½+ stars"],
    [st.binge ? String(st.binge.n) : "–", st.binge ? `episodes of ${st.binge.t.title}` : "most-binged series"], [st.busiest != null ? new Date(Date.UTC(Y, st.busiest, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" }) : "–", "busiest month"]];
  cells.forEach(([a, b], i) => {
    const cx = P + (i % 2) * 460, cy = 540 + Math.floor(i / 2) * 170;
    x.fillStyle = gold; x.globalAlpha = .45; x.fillRect(cx, cy, 400, 2); x.globalAlpha = 1;
    let fs = 62; x.font = `800 ${fs}px Fraunces`;
    while (x.measureText(a).width > 410 && fs > 34) { fs -= 2; x.font = `800 ${fs}px Fraunces`; }
    x.fillStyle = fg; x.fillText(a, cx, cy + 22 + (62 - fs) * 0.6);
    x.fillStyle = gold; x.font = "700 28px Nunito"; x.fillText(b.length > 28 ? b.slice(0, 27) + "…" : b, cx, cy + 100);
  });
  const favs = S().titles.filter(t => t.rating >= 4 && W.lastActivity(t).startsWith(String(Y))).sort((a, b) => b.rating - a.rating).slice(0, 5);
  favs.forEach((t, i) => {
    const px = P + i * 184, py = 1080, w = 164, h = 246;
    x.fillStyle = gcol(t.genre); x.fillRect(px, py, w, h);
    x.fillStyle = "rgba(255,255,255,.28)"; for (let k = 0; k < 7; k++) x.fillRect(px + k * 24 + 4, py, 12, 14);
    x.fillStyle = "#FFF7EC"; x.font = "800 13px Nunito"; x.fillText(t.kind === "series" ? "SERIES" : "FILM", px + 16, py + 30);
    x.font = "800 24px Fraunces"; wrap(x, t.title, px + 16, py + 52, w - 28, 27, 5);
    x.globalAlpha = .55; x.fillRect(px + 16, py + h - 40, w - 32, 2); x.globalAlpha = 1;
    x.font = "800 15px Nunito"; x.fillText(String(t.year || ""), px + 16, py + h - 30);
  });
  if (st.fav) {
    const fy = 1420, t = st.fav;
    x.fillStyle = gold; x.font = "800 26px Nunito"; x.fillText("FILM OF THE YEAR", P, fy);
    x.fillStyle = fg; x.font = "800 62px Fraunces"; wrap(x, t.title, P, fy + 44, 900, 66, 2);
    x.fillStyle = gold; x.font = "700 30px Nunito"; x.fillText([t.year, t.director].filter(Boolean).join(" · "), P, fy + 190);
  }
  x.fillStyle = gold; x.font = "700 44px 'Dancing Script'"; x.textAlign = "center"; x.fillText("made with Up Next", W0 / 2, 1830);
  return await new Promise(r => c.toBlob(r, "image/png"));
}
function wrap(x, text, X, Y, w, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = "", n = 0;
  for (const word of words) { const t = line ? line + " " + word : word; if (x.measureText(t).width > w && line) { x.fillText(line, X, Y + n * lh); line = word; if (++n >= maxLines) return; } else line = t; }
  if (line && n < maxLines) x.fillText(line, X, Y + n * lh);
}

// ============ Import, backup, export, calendar ============
const SAMPLE = [{ name: "diary.csv", text: "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-01-04,The General,1926,https://boxd.it/1,4.5,,,2026-01-03\n2026-02-14,Sunrise,1927,https://boxd.it/2,5,,,2026-02-14\n2026-03-01,It Happened One Night,1934,https://boxd.it/3,4,,,2026-02-28\n2026-03-20,The Thin Man,1934,https://boxd.it/4,4,,cosy,2026-03-19\n2026-04-11,Modern Times,1936,https://boxd.it/5,4.5,,,2026-04-10" },
  { name: "watchlist.csv", text: "Date,Name,Year,Letterboxd URI\n2026-05-01,Bringing Up Baby,1938,https://boxd.it/6\n2026-05-02,The Philadelphia Story,1940,https://boxd.it/7\n2026-05-03,Metropolis,1927,https://boxd.it/8" }];
actions["import"] = async () => {
  const files = app.demo ? SAMPLE : await pickFiles(".csv,text/csv,text/plain");
  if (!files || !files.length) return;
  let res; try { res = readFiles(files); } catch { return toast("I couldn't read that file."); }
  if (!res.titles.length) return toast(res.skipped.length ? "That doesn't look like a Letterboxd or IMDb export. Pick the CSV files from inside the download." : "No titles found in that file.");
  const { fresh, dupes } = importPlan(S(), res.titles);
  const c = (k, s) => fresh.filter(t => t.kind === k && t.status === s).length;
  openSheet(`${sheetHead("Import", "Cancel")}
    <p style="font-weight:700;color:var(--head);margin-bottom:.6rem">From ${esc(res.kind === "both" ? "Letterboxd and IMDb" : SOURCE_NAMES[res.kind])}: ${res.titles.length} titles found${dupes.length ? `, ${dupes.length} already in your library` : ""}.</p>
    <ul class="small" style="margin:0 0 1rem 1.2rem;color:var(--head);font-weight:600">
      <li>${c("film", "watched")} films watched, ${c("film", "watchlist")} on your watchlist</li>
      ${fresh.some(t => t.kind === "series") ? `<li>${fresh.filter(t => t.kind === "series").length} series (their episode lists can be found on each series page)</li>` : ""}
      <li>${fresh.filter(t => t.rating).length} with your rating, ${fresh.filter(t => t.watches.length).length} with the date you watched</li>
      ${res.skipped.length ? `<li>Skipped: ${res.skipped.map(esc).join(", ")}</li>` : ""}</ul>
    ${!app.demo ? `<p class="small muted" style="margin-bottom:1rem">Up Next then looks up each film's length and genre online, a few a second. You can keep using the app meanwhile.</p>` : ""}
    <button type="button" class="btn primary full" data-act="import-go"${fresh.length ? "" : " disabled"}>Import ${fresh.length} ${fresh.length === 1 ? "title" : "titles"}</button>`, { label: "Import" });
  actions["import-go"] = () => { commit(s => s.titles.push(...fresh)); closeSheet(); toast(`${fresh.length} titles imported.`); app.view = "library"; render(); enrichFilms(); };
};
actions["backup"] = async () => {
  const data = JSON.stringify({ app: "upnext", version: 1, exportedAt: new Date().toISOString(), state: S() });
  const r = await shareOrDownload(`up-next-backup-${app.today}.json`, data, "application/json");
  if (r === "cancelled") return;
  commit(s => { s.meta.lastBackup = new Date().toISOString(); });
  toast(r === "shared" ? "Backup ready. Save it to Files, Drive or email." : "Backup saved to your downloads.");
};
actions["restore"] = async () => {
  const f = await pickFile(".json,application/json"); if (!f) return;
  let d; try { d = JSON.parse(f.text); } catch { return toast("That file isn't an Up Next backup."); }
  if (d?.app !== "upnext" || !d.state) return toast("That file isn't an Up Next backup.");
  openSheet(`${sheetHead("Restore this backup?", "Cancel")}<p style="font-weight:600;color:var(--head);margin-bottom:1rem">Backup from ${esc(fd(String(d.exportedAt || "").slice(0, 10) || app.today))} with ${(d.state.titles || []).length} titles. It replaces what's on this device now.</p><button type="button" class="btn primary full" data-act="restore-go">Yes, restore it</button>`, { label: "Restore" });
  actions["restore-go"] = () => { const st = normalise(d.state); st.meta.unlocked = true; st.meta.setupDone = true; st.meta.demo = app.demo; app.S = st; commit(null); applyLook(); closeSheet(); app.view = "home"; render(); toast("Restored. Welcome back."); };
};
actions["move-phone"] = () => {
  const link = location.origin + location.pathname.replace(/index\.html$/, "");
  openSheet(`${sheetHead("Move to my phone (or laptop)")}<p class="small muted" style="margin-bottom:1rem">Your history lives on this device only, for privacy. Moving it takes a minute.</p>
    <ol class="steps"><li>Make a backup here<div style="margin-top:.4rem"><button type="button" class="btn soft small" data-act="backup">Back up now</button></div></li><li>Send the file to yourself<small>AirDrop, WhatsApp to yourself, email or Google Drive.</small></li>
    <li>On the other device, open Up Next<small><span style="word-break:break-all">${esc(link)}</span></small></li><li>Unlock, then Settings &rarr; Restore from a backup</li></ol>`, { label: "Move" });
};
actions["export-csv"] = async () => {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Title", "Kind", "Year", "Status", "Genre", "Your rating", "Watched on", "Episodes seen", "Service", "Director", "Minutes", "Marks", "Moods", "Notes", "IMDb"];
  const rows = S().titles.map(t => [q(t.title), t.kind, t.year || "", statusText(t), q(t.genre), t.rating || "", q((t.watches || []).map(w => w.date).filter(Boolean).join(" ")), t.kind === "series" ? W.progress(t, app.today).seen : "",
    q(svcById(t.service)?.name || ""), q(t.director), t.runtime || "", q((t.marks || []).join(", ")), q((t.moods || []).join(", ")), q(t.notes), t.imdb || ""].join(","));
  await shareOrDownload(`up-next-${app.today}.csv`, "﻿" + [head.join(","), ...rows].join("\r\n"), "text/csv");
  toast("Exported. Open it in Google Sheets (File, Import) or Excel.");
};
actions["ics"] = async () => {
  const D = s => s.replace(/-/g, ""), e = s => String(s).replace(/[\\;,]/g, m => "\\" + m);
  const ev = [];
  for (const t of S().titles) if (t.kind === "series" && !["dropped", "watchlist"].includes(t.status))
    for (const ep of W.episodes(t)) if (ep.airdate && ep.airdate >= app.today && ep.airdate <= addDays(app.today, 60) && !W.isSeen(t, ep))
      ev.push(["BEGIN:VEVENT", `UID:${t.id}-${W.epKey(ep.s, ep.e)}@upnext`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${D(ep.airdate)}`, `DTEND;VALUE=DATE:${D(addDays(ep.airdate, 1))}`, `SUMMARY:${e(`${t.title} ${W.epLabel(t, ep)}`)}`, "END:VEVENT"].join("\r\n"));
  if (!ev.length) return toast("No new episodes announced in the next two months.");
  await shareOrDownload("up-next-new-episodes.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Agneta//Up Next//EN", ...ev, "END:VCALENDAR", ""].join("\r\n"), "text/calendar");
  toast(`Open the file to add ${ev.length} episodes to your calendar.`);
};
let deferredPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
actions["install-help"] = () => openSheet(`${sheetHead("Put Up Next on your home screen")}<p class="small muted" style="margin-bottom:1rem">Then it opens like an app, works offline, and your phone keeps your history safe.</p>
  ${deferredPrompt ? `<button type="button" class="btn primary full" data-act="install-now" style="margin-bottom:1rem">Install now</button>` : ""}
  <h3 class="fr it" style="color:var(--head);margin-bottom:.5rem">iPhone or iPad</h3><ol class="steps"><li>Open this page in Safari</li><li>Tap the Share button<small>The square with an arrow.</small></li><li>Tap "Add to Home Screen", then "Add"</li></ol>
  <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Android</h3><ol class="steps"><li>Open this page in Chrome</li><li>Tap the three dots, top right</li><li>Tap "Install app" or "Add to Home screen"</li></ol>
  <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Laptop</h3><ol class="steps"><li>Chrome or Edge: the install icon at the right end of the address bar</li><li>Safari on Mac: File, then "Add to Dock"</li></ol>`, { label: "Install" });
actions["install-now"] = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; closeSheet(); };
actions["erase"] = () => openSheet(`${sheetHead("Erase everything?", "Cancel")}<p style="font-weight:600;color:var(--head);margin-bottom:1rem">This deletes your whole history on this device. It can't be undone. Make a backup first if you might want it back.</p><button type="button" class="btn soft full" data-act="backup" style="margin-bottom:.6rem">Back up first</button><button type="button" class="btn danger full" data-act="erase-go">Yes, erase everything</button>`, { label: "Erase" });
actions["erase-go"] = async () => { await store.wipe(); location.reload(); };
forms["profile"] = f => { commit(s => Object.assign(s.profile, { name: val(f, "name").trim().slice(0, 30), currency: val(f, "currency"), locale: val(f, "locale") })); toast("Saved."); };

// ============ Background: fresh episode lists, and film details after an import ============
let syncing = false;
export async function syncSeries() {
  if (syncing || app.demo || !navigator.onLine) return;
  syncing = true; let changed = 0;
  try {
    const due = S().titles.filter(t => t.kind === "series" && t.tvmaze && t.status !== "dropped" && (!t.synced || diffDays(t.synced, app.today) >= 1)).slice(0, 25);
    for (const t of due) {
      try { const dt = await seriesDetails(t.tvmaze); if (dt) { commit(s => { const x = s.titles.find(y => y.id === t.id); if (x) mergeSeries(x, dt); }, { render: false }); changed++; } } catch { break; }
      await new Promise(r => setTimeout(r, 600));
    }
  } finally { syncing = false; }
  if (changed && !document.querySelector("#sheet-root .sheet")) render();
}
export async function enrichFilms() {
  if (app.enrich || app.demo) return;
  const list = S().titles.filter(t => t.kind === "film" && !t.wikidata && !t.looked && (!t.runtime || t.genre === "Other"));
  if (!list.length) return;
  app.enrich = { done: 0, total: list.length };
  for (const t of list) {
    if (!navigator.onLine) break;
    try {
      const r = await findFilm(t.title, t.year);
      commit(s => { const x = s.titles.find(y => y.id === t.id); if (!x) return; x.looked = app.today; if (r) Object.assign(x, { wikidata: r.wikidata, runtime: x.runtime || r.runtime, genre: x.genre === "Other" ? r.genre : x.genre, director: x.director || r.director, imdb: x.imdb || r.imdb }); }, { render: false });
    } catch { break; }
    app.enrich.done++;
    if (app.enrich.done % 10 === 0 && !document.querySelector("#sheet-root .sheet")) render();
    await new Promise(r => setTimeout(r, 900));
  }
  app.enrich = null; if (!document.querySelector("#sheet-root .sheet")) render();
}

// ============ Unlock and setup ============
const CODE_HASH = "e7ca846b9b7efd499c106257a024c10070ff5e4cc71e2f123800dc8e16fa4844";
async function codeOK(code) {
  try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === CODE_HASH; }
  catch { return false; }
}
export function renderUnlock(msg = "") {
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card"><div class="logo fr">Up Next ${LOGO}</div>
    <h1 class="fr" style="font-size:1.7rem;color:var(--head);margin-bottom:.4rem">Welcome. <em class="it" style="color:var(--deep)">Popcorn's ready.</em></h1>
    <p style="font-weight:600;margin-bottom:1.2rem">Type the unlock code from your Etsy download (the PDF). You only do this once on each device.</p>
    <form data-form="unlock"><label class="field"><span>Unlock code</span><input class="input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XX-XXXX-XXXX" autofocus></label>
    ${msg ? `<p style="color:var(--link);font-weight:800;margin:-.3rem 0 .8rem">${esc(msg)}</p>` : ""}<button class="btn primary full" type="submit">Unlock</button></form>
    <p class="small muted" style="margin-top:1rem">Haven't bought it yet? <a href="?demo">Try the free demo</a>, or <a href="${ETSY_URL}" target="_blank" rel="noopener">find it on Etsy</a>.</p></div></div>`;
}
forms["unlock"] = async f => {
  if (!(await codeOK(val(f, "code")))) return renderUnlock("That code doesn't match. Check the PDF, or message the shop and we'll help.");
  app.S = blankState(); app.S.meta.unlocked = true; store.save(app.S); await store.flush(); wz = null; renderSetup();
};
let wz = null;
const SETUP_SERVICES = ["Netflix", "Prime Video", "Disney+", "Max", "Apple TV+", "Crunchyroll", "Viki", "Library app"];
export function renderSetup() {
  if (!wz) wz = { step: 1, name: "", look: "popcorn", partner: "", currency: guessCurrency(), svcs: {} };
  document.documentElement.dataset.look = wz.look;
  const prog = `<div class="progress">${[1, 2, 3].map(i => `<i class="${i <= wz.step ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (wz.step === 1) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Hello! Let's make it yours.</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Three quick steps. You can change everything later.</p>
    <label class="field"><span>What should I call you? <span class="muted">(optional)</span></span><input class="input" name="name" value="${esc(wz.name)}" autocomplete="given-name"></label>
    <div class="field"><span>Pick your look</span><div class="looks">${Object.entries(LOOKS).map(([k, l]) => `<button type="button" class="look" data-act="wz-look" data-v="${k}" aria-pressed="${wz.look === k}" style="--sw:${l.swatch};--pp:${l.paper}"><i></i>${esc(l.name)}</button>`).join("")}</div></div>`;
  if (wz.step === 2) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Who and where</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Both optional. They power watch-together and the streaming budget.</p>
    <label class="field"><span>Do you watch with someone?</span><input class="input" name="partner" value="${esc(wz.partner)}" placeholder="Their name, e.g. Benas"><small>Up Next keeps their place in shows you watch together, so nobody watches ahead.</small></label>
    <div class="field"><span>What do you pay for?</span><div class="chips">${SETUP_SERVICES.map(s => `<button type="button" class="chip pick${s in wz.svcs ? " on" : ""}" data-act="wz-svc" data-v="${esc(s)}" aria-pressed="${s in wz.svcs}">${esc(s)}</button>`).join("")}</div></div>
    ${Object.keys(wz.svcs).length ? `<div class="wz-prices">${Object.keys(wz.svcs).map(s => `<label class="field"><span>${esc(s)} a month</span><input class="input" name="p-${esc(s)}" inputmode="decimal" value="${esc(wz.svcs[s])}" placeholder="0"></label>`).join("")}</div>` : ""}
    <label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === wz.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  if (wz.step === 3) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Bring your history</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Already log what you watch somewhere? Bring it over in one go.</p>
    <button type="button" class="opt" data-act="wz-import"><div class="t"><b>Import from Letterboxd</b></div><small>Letterboxd: Settings, Data, Export your data. Unzip it and pick diary.csv, watched.csv, ratings.csv and watchlist.csv.</small></button>
    <button type="button" class="opt" data-act="wz-import"><div class="t"><b>Import from IMDb</b></div><small>IMDb: Your ratings (or Watchlist), the three dots, Export. You get a CSV file by email or in your downloads.</small></button>
    <button type="button" class="opt" data-act="wz-done" data-then="add"><div class="t"><b>Search my first title</b></div><small>Start fresh with what you're watching now.</small></button>`;
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card" style="max-width:36rem"><div class="logo fr">Up Next ${LOGO}</div>${prog}
    <form data-form="setup">${body}<div style="display:flex;gap:.6rem;margin-top:1.2rem">${wz.step > 1 ? `<button type="button" class="btn ghost" data-act="wz-back">Back</button>` : ""}${wz.step < 3 ? `<button class="btn primary" type="submit" style="flex:1">Next</button>` : `<button type="button" class="btn text" data-act="wz-done" style="flex:1">Skip for now</button>`}</div></form></div></div>`;
}
function guessCurrency() { const r = (navigator.language || "").split("-")[1] || ""; return { US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CH: "CHF", IN: "INR", ZA: "ZAR", KR: "KRW" }[r] || "EUR"; }
function syncWz() {
  const f = document.querySelector('form[data-form="setup"]'); if (!f) return;
  if (f.elements.name) wz.name = f.elements.name.value;
  if (f.elements.partner) { wz.partner = f.elements.partner.value; wz.currency = f.elements.currency.value; for (const s of Object.keys(wz.svcs)) if (f.elements["p-" + s]) wz.svcs[s] = f.elements["p-" + s].value; }
}
actions["wz-look"] = el => { syncWz(); wz.look = el.dataset.v; renderSetup(); };
actions["wz-svc"] = el => { syncWz(); const s = el.dataset.v; s in wz.svcs ? delete wz.svcs[s] : (wz.svcs[s] = ""); renderSetup(); };
actions["wz-back"] = () => { syncWz(); wz.step--; renderSetup(); };
forms["setup"] = () => { syncWz(); wz.step = Math.min(3, wz.step + 1); renderSetup(); };
function finishSetup() {
  Object.assign(S().profile, { name: wz.name.trim().slice(0, 30), look: wz.look, currency: wz.currency });
  if (wz.partner.trim()) S().people = [{ id: uid(), name: wz.partner.trim().slice(0, 24) }];
  S().services = Object.entries(wz.svcs).map(([name, p], i) => ({ id: uid(), name, price: num(p) || 0, cycle: "month", color: i % SERVICE_COLORS, paused: false, snooze: null }));
  S().meta.setupDone = true; S().meta.createdAt = new Date().toISOString();
  commit(null, { render: false }); store.askToPersist(); wz = null; app.view = "home"; app.start();
}
actions["wz-done"] = el => { const then = el.dataset.then; finishSetup(); if (then === "add") setTimeout(() => actions["add-title"]({ dataset: {} }), 300); else if (isIOS() && !isStandalone()) setTimeout(() => actions["install-help"](), 500); };
actions["wz-import"] = () => { finishSetup(); setTimeout(() => actions["import"](), 200); };
