// Up Next — the viewing maths. Pure functions only (no DOM), so they can be tested in Node.
import { addDays, diffDays, sum, round2 } from "./dates.js";
import { SCARY } from "./model.js";

const DATE = /^\d{4}-\d\d-\d\d$/;
export const epKey = (s, e) => `${s}-${e}`;
export const parseKey = k => (k ? String(k).split("-").map(Number) : null);
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");

// ---------- Episodes ----------
export function episodes(t) {
  const out = [];
  for (const se of [...(t.seasons || [])].sort((a, b) => a.n - b.n))
    for (const ep of [...(se.episodes || [])].sort((a, b) => a.n - b.n)) out.push({ s: se.n, e: ep.n, title: ep.title || "", airdate: ep.airdate || null, runtime: ep.runtime || null });
  return out;
}
export const singleSeason = t => (t.seasons || []).length <= 1;
export const epLabel = (t, ep) => (ep ? (singleSeason(t) ? `E${ep.e}` : `S${ep.s} E${ep.e}`) : "");
export const aired = (ep, today) => !ep.airdate || ep.airdate <= today;
export const isSeen = (t, ep) => !!(t.seen || {})[epKey(ep.s, ep.e)];
export const epMinutes = (t, ep) => (ep && ep.runtime) || t.runtime || 45;
export const filmMinutes = t => t.runtime || 100;

export function progress(t, today) {
  const all = episodes(t), on = all.filter(e => aired(e, today));
  const seen = all.filter(e => isSeen(t, e)).length;
  return { seen, aired: on.length, total: all.length, pct: on.length ? Math.min(100, (seen / on.length) * 100) : 0 };
}
// The episode after the last one you've seen (or the first one you haven't, if you skipped around).
export function nextEpisode(t, today) {
  const all = episodes(t);
  let last = -1;
  all.forEach((e, i) => { if (isSeen(t, e)) last = i; });
  return all.slice(last + 1).find(e => !isSeen(t, e) && aired(e, today)) || all.find(e => !isSeen(t, e) && aired(e, today)) || null;
}
export const upcomingEpisode = (t, today) => episodes(t).find(e => e.airdate && e.airdate > today && !isSeen(t, e)) || null;
export const caughtUp = (t, today) => episodes(t).length > 0 && !nextEpisode(t, today);
export function seasonLeft(t, today) {
  const nx = nextEpisode(t, today); if (!nx) return { episodes: 0, minutes: 0 };
  const left = episodes(t).filter(e => e.s === nx.s && !isSeen(t, e) && aired(e, today));
  return { episodes: left.length, minutes: sum(left, e => epMinutes(t, e)) };
}
export const myIndex = t => { let i = -1; episodes(t).forEach((e, k) => { if (isSeen(t, e)) i = k; }); return i; };
export const keyIndex = (t, key) => (key ? episodes(t).findIndex(e => epKey(e.s, e.e) === key) : -1);

// Watching together: where each person is, and a plain-words note when someone is behind.
export function together(t, people, today) {
  const all = episodes(t), me = myIndex(t);
  const rows = (t.with || []).map(pid => ({ person: people.find(p => p.id === pid), idx: keyIndex(t, (t.at || {})[pid]) })).filter(r => r.person);
  const behind = rows.filter(r => r.idx < me).sort((a, b) => a.idx - b.idx)[0];
  const ahead = rows.filter(r => r.idx > me).sort((a, b) => b.idx - a.idx)[0];
  let note = "";
  if (behind) { const n = me - behind.idx, nx = all[me + 1]; note = `${behind.person.name} is ${n === 1 ? "one episode" : `${n} episodes`} behind.${nx && aired(nx, today) ? ` Wait before ${epLabel(t, nx)}.` : ""}`; }
  else if (ahead) { const n = ahead.idx - me; note = `${ahead.person.name} is ${n === 1 ? "one episode" : `${n} episodes`} ahead of you.`; }
  else if (rows.length) note = "You're all on the same episode.";
  return { me, rows, note, total: all.length };
}

// ---------- What you watched, when ----------
// Every film watch and every dated episode tick. Episodes ticked in a catch-up ("I've seen up to here") have no date and don't count as time.
export function events(S) {
  const out = [];
  for (const t of S.titles) {
    if (t.kind === "series") {
      const byKey = new Map(episodes(t).map(e => [epKey(e.s, e.e), e]));
      for (const [k, d] of Object.entries(t.seen || {})) if (DATE.test(d)) { const [s, e] = parseKey(k); out.push({ date: d, t, kind: "ep", s, e, minutes: epMinutes(t, byKey.get(k)) }); }
    } else for (const w of t.watches || []) if (w && DATE.test(w.date || "")) out.push({ date: w.date, t, kind: "film", minutes: filmMinutes(t), with: w.with || [] });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function lastActivity(t) {
  let d = t.addedAt || "";
  for (const v of Object.values(t.seen || {})) if (DATE.test(v) && v > d) d = v;
  for (const w of t.watches || []) if (w && w.date > d) d = w.date;
  return d;
}
export function period(S, from, to) {
  const ev = events(S).filter(x => x.date >= from && x.date <= to);
  return { films: ev.filter(x => x.kind === "film").length, episodes: ev.filter(x => x.kind === "ep").length, minutes: sum(ev, x => x.minutes), events: ev };
}
export function monthStats(S, today) {
  const first = today.slice(0, 8) + "01", st = period(S, first, today);
  const weeks = [[1, 7], [8, 14], [15, 21], [22, 31]].map(([a, b]) => {
    const ev = st.events.filter(x => { const d = Number(x.date.slice(8)); return d >= a && d <= b; });
    return { ep: sum(ev.filter(x => x.kind === "ep"), x => x.minutes), film: sum(ev.filter(x => x.kind === "film"), x => x.minutes), from: a };
  });
  return { ...st, weeks };
}
export function yearStats(S, Y) {
  const st = period(S, `${Y}-01-01`, `${Y}-12-31`), ev = st.events;
  const byGenre = {}, byShow = new Map(), byService = {}, months = Array.from({ length: 12 }, () => ({ minutes: 0, films: 0, episodes: 0 }));
  for (const x of ev) {
    byGenre[x.t.genre || "Other"] = (byGenre[x.t.genre || "Other"] || 0) + x.minutes;
    if (x.kind === "ep") byShow.set(x.t, (byShow.get(x.t) || 0) + 1);
    if (x.t.service) byService[x.t.service] = (byService[x.t.service] || 0) + x.minutes;
    const m = months[Number(x.date.slice(5, 7)) - 1]; m.minutes += x.minutes; x.kind === "film" ? m.films++ : m.episodes++;
  }
  const genres = Object.entries(byGenre).sort((a, b) => b[1] - a[1]);
  const binge = [...byShow.entries()].sort((a, b) => b[1] - a[1])[0];
  const filmsSeen = [...new Set(ev.filter(x => x.kind === "film").map(x => x.t))];
  const rated = filmsSeen.filter(t => t.rating > 0);
  const fav = [...rated].sort((a, b) => b.rating - a.rating || lastActivity(b).localeCompare(lastActivity(a)))[0] || null;
  const showsFinished = S.titles.filter(t => t.kind === "series" && t.finished && t.finished.startsWith(String(Y)));
  const busiest = months.reduce((b, m, i) => (m.minutes > (months[b]?.minutes || 0) ? i : b), 0);
  return {
    ...st, hours: Math.round(st.minutes / 60), genres, topGenre: genres[0]?.[0] || null, binge: binge ? { t: binge[0], n: binge[1] } : null,
    fav, avgRating: rated.length ? round2(sum(rated, t => t.rating) / rated.length) : null, loved: rated.filter(t => t.rating >= 4.5).length,
    showsFinished: showsFinished.length, byService, months, busiest: st.minutes ? busiest : null,
  };
}

// ---------- Streaming budget ----------
export const monthlyCost = svc => (svc.cycle === "year" ? round2((Number(svc.price) || 0) / 12) : Number(svc.price) || 0);
export function serviceReport(S, today) {
  const from = addDays(today, -29), all = events(S), recent = all.filter(x => x.date >= from && x.date <= today);
  const rows = S.services.map(svc => {
    const minutes = sum(recent.filter(x => x.t.service === svc.id), x => x.minutes);
    const used = all.filter(x => x.t.service === svc.id).map(x => x.date).pop() || null;
    const cost = svc.paused ? 0 : monthlyCost(svc), idle = used ? diffDays(used, today) : null;
    return { svc, cost, minutes, hours: Math.round(minutes / 6) / 10, perHour: cost > 0 && minutes > 0 ? round2(cost / (minutes / 60)) : null, lastUsed: used, idleDays: idle, nudge: !svc.paused && cost > 0 && idle != null && idle >= 28 && !(svc.snooze && diffDays(svc.snooze, today) < 60) };
  });
  const paid = rows.filter(r => r.cost > 0), cost = round2(sum(paid, r => r.cost)), minutes = sum(paid, r => r.minutes);
  return { rows, cost, year: round2(cost * 12), perHour: cost > 0 && minutes > 0 ? round2(cost / (minutes / 60)) : null, hours: Math.round(minutes / 6) / 10 };
}

// ---------- Movie night ----------
const MOOD_GENRES = { cosy: ["Animation", "Comedy", "Romance"], funny: ["Comedy", "Animation"], romantic: ["Romance", "K-drama"], "feel-good": ["Comedy", "Animation", "Romance"],
  mystery: ["Mystery & crime"], tense: ["Mystery & crime", "Horror"], scary: ["Horror"], emotional: ["Drama", "Romance", "K-drama"], epic: ["Sci-fi & fantasy"],
  thoughtful: ["Documentary", "Drama"], light: ["Comedy", "Animation"], festive: [] };
export const moodFits = (t, m) => (t.moods || []).includes(m) || (MOOD_GENRES[m] || []).includes(t.genre);
const scary = t => SCARY.includes(t.genre) || (t.moods || []).includes("scary") || (t.marks || []).includes("scary");
export function movieNight(S, opts = {}, today, rnd = Math.random) {
  const { minutes = 0, moods = [], noScary = false, comfort = false, skip = [] } = opts;
  let c = S.titles.filter(t => t.kind === "film" && (t.status === "watchlist" || (comfort && (t.marks || []).includes("comfort watch"))));
  if (minutes) c = c.filter(t => filmMinutes(t) <= minutes);
  if (noScary) c = c.filter(t => !scary(t));
  if (moods.length) c = c.filter(t => moods.some(m => moodFits(t, m)));
  const pool = c.filter(t => !skip.includes(t.id)), from = pool.length ? pool : c;
  if (!from.length) return { pick: null, count: 0 };
  const w = from.map(t => 1 + Math.max(0, diffDays(t.addedAt || today, today)) / 60);   // longer on your list = a little more likely
  let r = rnd() * sum(w), i = 0;
  while (i < from.length - 1 && (r -= w[i]) > 0) i++;
  return { pick: from[i], count: c.length };
}

// ---------- New episodes ----------
export function newEpisodes(S, today, ahead = 21) {
  const out = [];
  for (const t of S.titles) {
    if (t.kind !== "series" || t.status === "dropped" || t.status === "watchlist") continue;
    const ep = episodes(t).find(e => e.airdate && e.airdate >= addDays(today, -3) && e.airdate <= addDays(today, ahead) && !isSeen(t, e));
    if (ep) out.push({ t, ep, days: diffDays(today, ep.airdate), seasonStart: ep.e === 1 });
  }
  return out.sort((a, b) => a.ep.airdate.localeCompare(b.ep.airdate));
}

// ---------- Lists ----------
export const watchingNow = S => S.titles.filter(t => t.kind === "series" && t.status === "watching").sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
export const watchlist = S => S.titles.filter(t => t.status === "watchlist").sort((a, b) => (a.addedAt || "").localeCompare(b.addedAt || ""));
export function findTitle(S, q) {
  return S.titles.find(t => (q.tvmaze && t.tvmaze === q.tvmaze) || (q.wikidata && t.wikidata === q.wikidata) || (q.imdb && t.imdb === q.imdb))
    || S.titles.find(t => t.kind === (q.kind || t.kind) && norm(t.title) === norm(q.title) && (!q.year || !t.year || Math.abs(t.year - q.year) <= 1)) || null;
}
