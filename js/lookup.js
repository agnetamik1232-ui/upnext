// Up Next — finding series (TVmaze, CC BY-SA, credited in the app) and films (Wikidata, CC0). No keys, no accounts.
const TVM = "https://api.tvmaze.com";
const WD = "https://www.wikidata.org/w/api.php";

async function getJSON(url, { timeout = 10000, retry = true } = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.status === 429 && retry) { await new Promise(res => setTimeout(res, 2500)); return getJSON(url, { timeout, retry: false }); }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const enc = encodeURIComponent;

// ---------- Series (TVmaze) ----------
export function seriesGenre(sh) {
  const g = (sh.genres || []).map(x => x.toLowerCase()), type = (sh.type || "").toLowerCase();
  if (type === "animation" || g.includes("anime")) return "Animation";
  if (type === "documentary") return "Documentary";
  if ((sh.language || "") === "Korean" && type !== "reality" && type !== "variety") return "K-drama";
  if (g.includes("horror")) return "Horror";
  if (g.some(x => ["science-fiction", "fantasy", "supernatural"].includes(x))) return "Sci-fi & fantasy";
  if (g.some(x => ["crime", "mystery", "thriller", "espionage", "legal"].includes(x))) return "Mystery & crime";
  if (g.includes("comedy") || g.includes("family")) return "Comedy";
  if (g.includes("romance")) return "Romance";
  if (g.length || type === "scripted") return "Drama";
  return "Other";
}
function show(sh) {
  return { kind: "series", tvmaze: sh.id, title: sh.name, year: sh.premiered ? Number(sh.premiered.slice(0, 4)) : null,
    network: sh.network?.name || sh.webChannel?.name || "", genre: seriesGenre(sh), runtime: sh.averageRuntime || sh.runtime || null,
    poster: sh.image?.medium || "", imdb: sh.externals?.imdb || "", link: sh.url || "", ended: sh.status === "Ended" };
}
export async function searchSeries(q) {
  const r = await getJSON(`${TVM}/search/shows?q=${enc(q)}`);
  return (r || []).slice(0, 8).map(x => show(x.show));
}
export async function seriesDetails(id) {
  const sh = await getJSON(`${TVM}/shows/${id}?embed[]=episodes`);
  if (!sh) return null;
  const by = new Map();
  for (const e of sh._embedded?.episodes || []) {
    if (e.number == null || (e.type && e.type !== "regular")) continue;
    if (!by.has(e.season)) by.set(e.season, []);
    by.get(e.season).push({ n: e.number, title: e.name || "", airdate: e.airdate || null, runtime: e.runtime || null });
  }
  const seasons = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([n, episodes]) => ({ n, episodes: episodes.sort((a, b) => a.n - b.n) }));
  return { ...show(sh), seasons };
}
export async function findSeries(title, year) {
  const list = await searchSeries(title);
  return list.find(x => year && x.year && Math.abs(x.year - year) <= 1) || list[0] || null;
}

// ---------- Films (Wikidata) ----------
const FILM = /\bfilm\b|\bmovie\b/i;
const NOT_FILM = /series|episode|soundtrack|album|novel|character|franchise|festival|award|actor|actress|director|studio|company|song|book|magazine|video game|season|list of/i;
const MIN = "Q7727", HOUR = "Q25235", SEC = "Q11574";
export function filmGenre(labels) {
  const all = labels.join(" | ").toLowerCase();
  const rules = [[/animat/, "Animation"], [/documentary/, "Documentary"], [/horror/, "Horror"], [/science fiction|fantasy|superhero|space opera/, "Sci-fi & fantasy"],
    [/crime|thriller|mystery|noir|heist|detective|gangster|spy/, "Mystery & crime"], [/romantic comedy|rom-com/, "Romance"], [/comedy|comedic|sitcom/, "Comedy"], [/romance|romantic/, "Romance"], [/drama|biographical|war film|historical/, "Drama"]];
  for (const [re, g] of rules) if (re.test(all)) return g;
  return labels.length ? "Drama" : "Other";
}
const claim = (e, p) => (e.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(v => v != null);
export async function searchFilms(q, limit = 8) {
  const r = await getJSON(`${WD}?action=wbsearchentities&search=${enc(q)}&language=en&uselang=en&type=item&limit=25&format=json&origin=*`);
  const hits = (r?.search || []).filter(x => FILM.test(x.description || "") && !NOT_FILM.test(x.description || "")).slice(0, limit);
  if (!hits.length) return [];
  const ents = (await getJSON(`${WD}?action=wbgetentities&ids=${hits.map(h => h.id).join("|")}&props=claims|labels&languages=en&format=json&origin=*`))?.entities || {};
  const more = new Set();
  for (const h of hits) { const e = ents[h.id]; if (!e) continue; [...claim(e, "P57").slice(0, 2), ...claim(e, "P136").slice(0, 6)].forEach(v => v.id && more.add(v.id)); }
  const labels = {};
  const ids = [...more];
  for (let i = 0; i < ids.length; i += 50) {
    const l = (await getJSON(`${WD}?action=wbgetentities&ids=${ids.slice(i, i + 50).join("|")}&props=labels&languages=en&format=json&origin=*`))?.entities || {};
    for (const [k, v] of Object.entries(l)) labels[k] = v.labels?.en?.value || "";
  }
  return hits.map(h => {
    const e = ents[h.id] || {};
    const years = claim(e, "P577").map(v => Number(String(v.time || "").slice(1, 5))).filter(Boolean);
    const rt = claim(e, "P2047")[0];
    let runtime = rt ? Math.abs(Number(rt.amount)) : null;
    if (runtime && rt.unit) { if (rt.unit.endsWith(HOUR)) runtime *= 60; else if (rt.unit.endsWith(SEC)) runtime /= 60; else if (!rt.unit.endsWith(MIN)) runtime = null; }
    return { kind: "film", wikidata: h.id, title: e.labels?.en?.value || h.label || q, year: years.length ? Math.min(...years) : null,
      runtime: runtime ? Math.round(runtime) : null, director: claim(e, "P57").slice(0, 2).map(v => labels[v.id]).filter(Boolean).join(" & "),
      genre: filmGenre(claim(e, "P136").map(v => labels[v.id] || "")), imdb: claim(e, "P345")[0] || "", about: h.description || "" };
  });
}
export async function findFilm(title, year) {
  const list = await searchFilms(title, 6);
  return list.find(x => year && x.year && Math.abs(x.year - year) <= 1) || (year ? null : list[0]) || null;
}

// One search box for both: series from TVmaze and films from Wikidata, side by side.
export async function searchAll(q) {
  const [s, f] = await Promise.allSettled([searchSeries(q), searchFilms(q)]);
  const series = s.status === "fulfilled" ? s.value : [], films = f.status === "fulfilled" ? f.value : [];
  const out = [], n = Math.max(series.length, films.length);
  for (let i = 0; i < n; i++) { if (films[i]) out.push(films[i]); if (series[i]) out.push(series[i]); }
  return { results: out, offline: s.status === "rejected" && f.status === "rejected" };
}
