// Up Next — small drawing helpers shared by the screens and sheets.
import { app, esc, fWeekday } from "./core.js";

export const genreColor = g => { const i = app.S.genres.indexOf(g); return `var(--p${(i < 0 ? 9 : i) % 10})`; };
export const svcColor = svc => `var(--p${((svc?.color ?? 9) * 3 + 1) % 10})`;
export const svcById = id => app.S.services.find(s => s.id === id);
export const personById = id => app.S.people.find(p => p.id === id);

// A poster: the real one when there is one (series, or your own picture), otherwise a drawn card in your look.
export function poster(t, w = 96, extra = "", lazy = false) {
  const h = Math.round(w * 1.5), src = t.picture || t.poster;
  const img = src ? `<img src="${esc(src)}" alt=""${lazy ? ' loading="lazy"' : ""} decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  const longest = Math.max(1, ...String(t.title || "").split(/\s+/).map(x => x.length));
  const fs = longest > 8 ? (0.15 * 8 / longest).toFixed(4) : "0.15";
  return `<div class="pt" style="--c:${genreColor(t.genre)};--w:${w}px;width:${w}px;height:${h}px" ${extra}><div class="art"><div class="pk">${t.kind === "series" ? "SERIES" : "FILM"}</div><div class="pn" style="font-size:calc(var(--w) * ${fs})">${esc(t.title)}</div><div class="pl"></div><div class="py">${esc(t.year || "")}</div></div>${img}</div>`;
}
export const blankPoster = (genre, w = 38) => `<div class="pt" style="--c:${genreColor(genre)};--w:${w}px;width:${w}px;height:${Math.round(w * 1.5)}px"><div class="art"></div></div>`;

const STAR = "M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z";
let sid = 0;
export function stars(r, size = 16) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, (r || 0) - i)), id = "s" + ++sid;
    out += `<svg viewBox="0 0 24 24" style="width:${size}px;height:${size}px"><defs><clipPath id="${id}"><rect width="${(24 * f).toFixed(1)}" height="24"/></clipPath></defs><path d="${STAR}" fill="var(--track)"/><path d="${STAR}" fill="var(--gold)" clip-path="url(#${id})"/></svg>`;
  }
  return `<span class="stars" aria-label="${r || 0} stars">${out}</span>`;
}
export const ratingText = r => { if (!r) return "not rated"; const w = Math.floor(r), q = Math.round((r - w) * 4); return `${w || ""}${["", "¼", "½", "¾"][q]} ${r === 1 ? "star" : "stars"}`.trim(); };

export const hm = m => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
export const hours = m => { const h = (m || 0) / 60; return h >= 10 || h === 0 ? `${Math.round(h)} h` : `${h.toFixed(1).replace(/\.0$/, "")} h`; };
export function whenLabel(days, date) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return fWeekday(date);
  if (days >= 7) return `In ${days} days`;
  return `${-days} days ago`;
}
export const STATUS_LABEL = { watching: "Watching", watchlist: "Watchlist", watched: "Watched", paused: "Paused", dropped: "Stopped" };
export const statusText = t => (t.kind === "film" && t.status === "watched" ? (t.watches.length > 1 ? `Watched ${t.watches.length} times` : "Watched") : t.kind === "series" && t.status === "watched" ? "Finished" : STATUS_LABEL[t.status] || "");

export const ICON = {
  tick: '<svg viewBox="0 0 20 20" class="ic"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.8"/></svg>',
  clock: '<svg viewBox="0 0 20 20" class="ic"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  heart: '<svg viewBox="0 0 20 20" class="ic"><path d="M10 17s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.7-7 9-7 9z" fill="currentColor"/></svg>',
  drop: '<svg viewBox="0 0 20 20" class="ic"><path d="M10 2.5S4.5 9 4.5 12.5a5.5 5.5 0 0 0 11 0C15.5 9 10 2.5 10 2.5z" fill="currentColor"/></svg>',
  tv: '<svg viewBox="0 0 20 20" class="ic"><rect x="2" y="4" width="16" height="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 18h6" stroke="currentColor" stroke-width="2"/></svg>',
  people: '<svg viewBox="0 0 20 20" class="ic"><circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="14" cy="8" r="2.4" fill="currentColor"/><path d="M1.5 17c.5-3.5 3-5 5.5-5s5 1.5 5.5 5zM12 17c.2-2 .9-3.4 2-4.2 2.2 0 4 1.4 4.5 4.2z" fill="currentColor"/></svg>',
};
export const LOGO = '<svg viewBox="0 0 32 32" class="logo-ic" aria-hidden="true"><circle cx="11" cy="9" r="5" fill="var(--gold)"/><circle cx="18" cy="7" r="5.5" fill="var(--gold)"/><circle cx="24" cy="10" r="4.5" fill="var(--gold)"/><path d="M5 12h22l-3 18H8z" fill="#FFFDF8" stroke="var(--accent)" stroke-width="1.6"/><path d="M9.5 12l1.5 18M16 12v18M22.5 12L21 30" stroke="var(--accent)" stroke-width="3"/></svg>';
