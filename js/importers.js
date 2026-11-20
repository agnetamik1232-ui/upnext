// Up Next — bringing your history over from Letterboxd and IMDb (both let you download your data as CSV files).
import { parseCSV } from "./csv.js";
import { newTitle } from "./model.js";
import { findTitle, norm } from "./watch.js";
import { filmGenre } from "./lookup.js";

export const SOURCE_NAMES = { letterboxd: "Letterboxd", imdb: "IMDb" };
const DATE = /^\d{4}-\d\d-\d\d$/;

export function detect(name, header) {
  const h = header.map(x => x.toLowerCase().trim()), n = String(name || "").toLowerCase();
  if (h.includes("letterboxd uri")) return { kind: "letterboxd", file: n.includes("watchlist") ? "watchlist" : n.includes("like") ? "likes" : h.includes("watched date") ? "diary" : h.includes("rating") ? "ratings" : "watched" };
  if (h.includes("const") && h.includes("title type")) return { kind: "imdb", file: h.includes("position") || n.includes("watchlist") ? "watchlist" : "ratings" };
  return null;
}

const IMDB_KIND = { "movie": "film", "tv movie": "film", "short": "film", "video": "film", "tv special": "film", "tv series": "series", "tv mini series": "series", "tv miniseries": "series" };

export function readFiles(files) {
  const map = new Map(), skipped = [], kinds = new Set();
  const keyOf = (kind, title, year) => `${kind}|${norm(title)}|${year || ""}`;
  const get = (kind, title, year, extra = {}) => {
    const k = keyOf(kind, title, year);
    if (!map.has(k)) map.set(k, newTitle({ kind, title, year: year || null, status: "watchlist", ...extra }));
    return map.get(k);
  };
  for (const f of files) {
    const rows = parseCSV(f.text);
    if (rows.length < 1) { skipped.push(f.name); continue; }
    const head = rows[0], d = detect(f.name, head);
    if (!d) { skipped.push(f.name); continue; }
    kinds.add(d.kind);
    const col = name => head.findIndex(x => x.toLowerCase().trim() === name);
    const v = (r, name) => { const i = col(name); return i >= 0 ? (r[i] || "").trim() : ""; };
    for (const r of rows.slice(1)) {
      if (d.kind === "letterboxd") {
        const title = v(r, "name"); if (!title) continue;
        const year = Number(v(r, "year")) || null, t = get("film", title, year);
        const rating = Number(v(r, "rating")) || 0;
        if (rating) t.rating = rating;
        if (d.file === "watchlist") continue;
        if (d.file === "likes") { if (!t.marks.includes("loved")) t.marks.push("loved"); continue; }
        t.status = "watched";
        if (d.file === "diary") {
          const date = v(r, "watched date") || v(r, "date");
          if (DATE.test(date)) t.watches.push({ date, with: [] });
          if (/yes/i.test(v(r, "rewatch")) && !t.marks.includes("rewatch")) t.marks.push("rewatch");
          for (const tag of v(r, "tags").split(",").map(x => x.trim().toLowerCase()).filter(Boolean)) if (!t.marks.includes(tag)) t.marks.push(tag.slice(0, 30));
        }
      } else {
        const type = v(r, "title type").toLowerCase(), kind = IMDB_KIND[type];
        const title = v(r, "title"); if (!title || !kind) continue;
        const year = Number(v(r, "year")) || null;
        const t = get(kind, title, year, { imdb: v(r, "const") });
        t.imdb = v(r, "const") || t.imdb;
        t.runtime = Number(v(r, "runtime (mins)")) || t.runtime;
        const g = v(r, "genres"); if (g) t.genre = filmGenre(g.split(",").map(x => x.trim()));
        t.director = v(r, "directors").split(",").slice(0, 2).join(" & ") || t.director;
        const mine = Number(v(r, "your rating")) || 0;
        if (mine) t.rating = Math.round(mine / 2 * 4) / 4;
        if (d.file === "ratings" || mine) t.status = "watched";
      }
    }
  }
  for (const t of map.values()) {
    t.watches.sort((a, b) => a.date.localeCompare(b.date));
    if (t.watches.length > 1 && !t.marks.includes("rewatch")) t.marks.push("rewatch");
    if (t.kind === "series" && t.status === "watched") t.finished = null;
  }
  return { kind: kinds.size === 1 ? [...kinds][0] : kinds.size ? "both" : null, titles: [...map.values()], skipped };
}

export function plan(S, titles) {
  const fresh = [], dupes = [];
  for (const t of titles) (findTitle(S, t) ? dupes : fresh).push(t);
  return { fresh, dupes };
}
