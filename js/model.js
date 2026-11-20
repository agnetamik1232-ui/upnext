// Up Next — the shape of a viewer's data, and defaults.
import { GENRES } from "./looks.js";
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const KINDS = [["series", "Series"], ["film", "Film"]];
// Series: watching / watchlist / watched (finished) / paused / dropped. Films: watchlist / watched / dropped.
export const STATUSES = [["watching", "Watching"], ["watchlist", "Watchlist"], ["watched", "Watched"], ["paused", "Paused"], ["dropped", "Stopped watching"]];
export const FILM_STATUSES = [["watchlist", "Watchlist"], ["watched", "Watched"], ["dropped", "Stopped watching"]];
export const MARKS = ["comfort watch", "made me cry", "rewatch", "twist", "so funny", "scary", "slow burn", "cosy"];
export const MOODS = ["cosy", "funny", "romantic", "feel-good", "mystery", "tense", "scary", "emotional", "epic", "thoughtful", "light", "festive"];
export const SCARY = ["Horror"];
export const CURRENCIES = [["EUR", "Euro (€)"], ["USD", "US dollar ($)"], ["GBP", "Pound (£)"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"], ["NZD", "New Zealand dollar"], ["CHF", "Swiss franc"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"], ["ZAR", "South African rand"], ["INR", "Indian rupee"], ["SGD", "Singapore dollar"], ["JPY", "Japanese yen"], ["MXN", "Mexican peso"], ["BRL", "Brazilian real"], ["PHP", "Philippine peso"], ["KRW", "Korean won"]];
export const SERVICE_IDEAS = ["Netflix", "Prime Video", "Disney+", "Max", "Apple TV+", "Hulu", "Paramount+", "Peacock", "Crunchyroll", "Viki", "YouTube Premium", "Now", "BritBox", "Mubi", "Library app", "TV", "Cinema", "DVD / Blu-ray"];
export const SERVICE_COLORS = 8;

export function blankState() {
  return {
    version: VERSION,
    profile: { name: "", currency: "EUR", locale: navLocale(), look: "popcorn", bigText: false, easyFont: false, spoilers: false, together: true },
    people: [],                 // who you watch with: { id, name }
    services: [],               // what you pay for: { id, name, price, cycle: "month" | "year", color, paused }
    titles: [],
    genres: [...GENRES],
    meta: { createdAt: new Date().toISOString(), setupDone: false, unlocked: false, demo: false, lastBackup: null, lastSync: null },
  };
}
function navLocale() { try { return navigator.language || "en-GB"; } catch { return "en-GB"; } }

export function newTitle(fields = {}) {
  return {
    id: uid(), kind: "film", title: "", year: null, genre: "Other", runtime: null, director: "", network: "", poster: "", picture: "",
    tvmaze: null, wikidata: "", imdb: "", status: "watchlist", service: "", price: null,
    rating: 0, ratings: {}, marks: [], moods: [], notes: "",
    watches: [],                // films: [{ date, with: [personId] }] (more than one = rewatched)
    seasons: [],                // series: [{ n, episodes: [{ n, title, airdate, runtime }] }]
    seen: {},                   // series, you: { "2-5": "2026-11-18" }
    at: {},                     // series, people you watch with: { personId: "2-4" } (the last episode they've seen)
    with: [],                   // people this is watched with
    addedAt: new Date().toISOString().slice(0, 10), finished: null, synced: null,
    ...fields,
  };
}

export function normalise(s) {
  const b = blankState();
  const out = { ...b, ...s };
  out.profile = { ...b.profile, ...(s.profile || {}) };
  out.meta = { ...b.meta, ...(s.meta || {}) };
  out.people = Array.isArray(s.people) ? s.people.filter(p => p && p.id && p.name) : [];
  out.services = Array.isArray(s.services) ? s.services.map((x, i) => ({ id: x.id || uid(), name: x.name || "Service", price: Number(x.price) || 0, cycle: x.cycle === "year" ? "year" : "month", color: x.color ?? i % SERVICE_COLORS, paused: !!x.paused, snooze: x.snooze || null })) : [];
  out.titles = Array.isArray(s.titles) ? s.titles.map(x => newTitle({ ...x, id: x.id || uid() })) : [];
  out.genres = Array.isArray(s.genres) && s.genres.length ? s.genres : [...GENRES];
  out.version = VERSION;
  return out;
}
