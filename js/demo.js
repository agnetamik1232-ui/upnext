// Up Next — the free demo: Mia, who watches with Benas. Public-domain films and made-up series, always dated around today.
import { blankState, newTitle } from "./model.js";
import { addDays, diffDays } from "./dates.js";
import { epKey } from "./watch.js";

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// [title, year, minutes, director, genre, moods]
const WATCHED = [
  ["Charade", 1963, 113, "Stanley Donen", "Mystery & crime", ["romantic", "mystery"], 4.75, ["comfort watch", "rewatch"], "Watch again next winter with hot chocolate."],
  ["The Kid", 1921, 68, "Charlie Chaplin", "Comedy", ["emotional", "funny"], 4.5, ["made me cry"], ""],
  ["Sherlock Jr.", 1924, 45, "Buster Keaton", "Comedy", ["funny", "light"], 4.25, [], ""],
  ["The Gold Rush", 1925, 95, "Charlie Chaplin", "Comedy", ["funny"], 4, [], ""],
  ["Penny Serenade", 1941, 119, "George Stevens", "Romance", ["emotional", "romantic"], 4.5, ["made me cry"], "Needed tissues. Benas pretended he didn't."],
  ["Love Affair", 1939, 88, "Leo McCarey", "Romance", ["romantic"], 4.25, [], ""],
  ["Nosferatu", 1922, 94, "F. W. Murnau", "Horror", ["scary"], 3.5, ["scary"], "Halloween pick. Benas loved it more than me."],
  ["The Stranger", 1946, 95, "Orson Welles", "Mystery & crime", ["tense", "mystery"], 4, [], ""],
  ["Scarlet Street", 1945, 102, "Fritz Lang", "Mystery & crime", ["tense"], 4, ["twist"], ""],
  ["Meet John Doe", 1941, 122, "Frank Capra", "Drama", ["thoughtful"], 4, [], ""],
  ["Royal Wedding", 1951, 93, "Stanley Donen", "Romance", ["light", "feel-good"], 3.75, [], ""],
  ["Nothing Sacred", 1937, 77, "William A. Wellman", "Comedy", ["funny"], 3.75, [], ""],
  ["Detour", 1945, 68, "Edgar G. Ulmer", "Mystery & crime", ["tense"], 3.5, [], ""],
  ["D.O.A.", 1949, 83, "Rudolph Maté", "Mystery & crime", ["mystery"], 3.75, ["twist"], ""],
  ["The Cabinet of Dr. Caligari", 1920, 76, "Robert Wiene", "Horror", ["scary"], 3.75, [], ""],
  ["Father's Little Dividend", 1951, 82, "Vincente Minnelli", "Comedy", ["light"], 3.5, [], ""],
  ["Our Hospitality", 1923, 74, "Buster Keaton", "Comedy", ["funny"], 3.75, [], ""],
  ["The Phantom of the Opera", 1925, 93, "Rupert Julian", "Horror", ["scary"], 3.75, [], ""],
  ["Topper Returns", 1941, 88, "Roy Del Ruth", "Comedy", ["funny", "mystery"], 3.5, [], ""],
  ["Battleship Potemkin", 1925, 75, "Sergei Eisenstein", "Drama", ["epic"], 3.5, [], ""],
  ["The Lost World", 1925, 93, "Harry O. Hoyt", "Sci-fi & fantasy", ["epic"], 3.25, [], ""],
  ["Sunrise", 1927, 94, "F. W. Murnau", "Romance", ["romantic", "emotional"], 4.5, ["comfort watch"], ""],
];
const WATCHLIST = [
  ["Metropolis", 1927, 153, "Fritz Lang", "Sci-fi & fantasy", ["epic"], 210],
  ["His Girl Friday", 1940, 92, "Howard Hawks", "Comedy", ["funny", "romantic"], 190],
  ["My Man Godfrey", 1936, 94, "Gregory La Cava", "Romance", ["funny", "romantic"], 160],
  ["The General", 1926, 78, "Buster Keaton", "Comedy", ["funny"], 150],
  ["Safety Last!", 1923, 73, "Fred C. Newmeyer", "Comedy", ["funny", "light"], 140],
  ["A Star Is Born", 1937, 111, "William A. Wellman", "Drama", ["emotional"], 120],
  ["Kansas City Confidential", 1952, 99, "Phil Karlson", "Mystery & crime", ["tense"], 110],
  ["Beat the Devil", 1953, 89, "John Huston", "Comedy", ["funny"], 95],
  ["Carnival of Souls", 1962, 78, "Herk Harvey", "Horror", ["scary"], 80],
  ["The Little Shop of Horrors", 1960, 72, "Roger Corman", "Comedy", ["funny"], 70],
  ["The Last Time I Saw Paris", 1954, 116, "Richard Brooks", "Romance", ["romantic", "emotional"], 64],
  ["Algiers", 1938, 99, "John Cromwell", "Romance", ["romantic"], 58],
  ["The Navigator", 1924, 59, "Buster Keaton", "Comedy", ["funny", "light"], 50],
  ["Seven Chances", 1925, 56, "Buster Keaton", "Comedy", ["funny", "romantic"], 41],
  ["The Man with the Golden Arm", 1955, 119, "Otto Preminger", "Drama", ["thoughtful"], 33],
  ["Peter Pan", 1924, 105, "Herbert Brenon", "Sci-fi & fantasy", ["cosy", "feel-good"], 25],
  ["The Thief of Bagdad", 1924, 140, "Raoul Walsh", "Sci-fi & fantasy", ["epic"], 19],
  ["Plan 9 from Outer Space", 1957, 79, "Ed Wood", "Sci-fi & fantasy", ["funny"], 12],
  ["McLintock!", 1963, 127, "Andrew V. McLaglen", "Comedy", ["funny"], 6],
];

// Made-up series. sched(e, s) gives each episode's air date as days from today.
const SHOWS = [
  { title: "Saltwater Hollow", genre: "Drama", svc: "netflix", runtime: 55, status: "watching", rating: 4.25, with: true, moods: ["tense", "emotional"],
    seasons: [[8, e => -400 + e], [8, e => -42 + 7 * e]], names: [["The Return", "Low Tide", "The Keeper", "Fog Signal", "Undertow", "Driftwood", "High Water", "The Crossing"], ["Homecoming", "Salt", "Old Charts", "The Storm Wall", "Lanterns", "Cold Harbour", "Breakwater", "First Light"]],
    seen: { 1: [1, 8, -150, 5], 2: [1, 4, -33, 7] }, benas: "2-3" },
  { title: "The Quiet Bakery", genre: "Comedy", svc: "netflix", runtime: 24, status: "watching", rating: 4, moods: ["cosy", "funny"], seasons: [[10, () => -40]], seen: { 1: [1, 2, -4, 2] } },
  { title: "Moonlight in Mapo", genre: "K-drama", svc: "netflix", runtime: 62, status: "watching", rating: 4.5, moods: ["romantic", "emotional"],
    seasons: [[16, e => -45 + 7 * Math.floor((e - 1) / 2) + ((e - 1) % 2)]], seen: { 1: [1, 12, -40, 2.6] } },
  { title: "Lantern Street Mysteries", genre: "Mystery & crime", svc: "prime", runtime: 48, status: "watching", rating: 4, with: true, moods: ["mystery", "cosy"],
    seasons: [[6, e => -700 + 7 * e], [6, e => -300 + 7 * e], [6, e => 2 + 7 * e]], seen: { 1: [1, 6, -280, 4], 2: [1, 6, -250, 6] }, benas: "2-6" },
  { title: "Starfall Station", genre: "Sci-fi & fantasy", svc: "prime", runtime: 50, status: "paused", rating: 3.5, moods: ["epic"], seasons: [[10, () => -500], [10, () => -130]], seen: { 1: [1, 6, -120, 5] } },
  { title: "Midnight Museum", genre: "Mystery & crime", svc: "disney", runtime: 42, status: "paused", rating: 3.75, moods: ["mystery"], seasons: [[6, () => -200], [6, () => -90]], seen: { 1: [1, 4, -60, 6] } },
  { title: "Teacup Cottage", genre: "Comedy", svc: "netflix", runtime: 28, status: "watched", rating: 5, marks: ["comfort watch", "rewatch"], moods: ["cosy", "funny"], seasons: [[6, () => -900], [6, () => -800], [6, () => -700]], seen: { 1: [1, 6, -320, 2], 2: [1, 6, -306, 2], 3: [1, 6, -292, 2] }, finished: -281 },
  { title: "The Last Lighthouse Keeper", genre: "Drama", svc: "prime", runtime: 58, status: "watched", rating: 4.5, marks: ["made me cry"], moods: ["emotional"], seasons: [[4, () => -150]], seen: { 1: [1, 4, -140, 2] }, finished: -134, with: true, benas: "1-4" },
  { title: "Letters to Juniper", genre: "Romance", svc: "netflix", runtime: 45, status: "watched", rating: 4.25, moods: ["romantic", "light"], seasons: [[8, () => -260]], seen: { 1: [1, 8, -200, 4] }, finished: -172 },
  { title: "Little Fox Valley", genre: "Animation", svc: "disney", runtime: 22, status: "watched", rating: 4.75, marks: ["comfort watch"], moods: ["cosy", "feel-good"], seasons: [[12, () => -600], [12, () => -400]], seen: { 1: [1, 12, -300, 1], 2: [1, 12, -285, 1] }, finished: -274 },
  { title: "The Orchard Year", genre: "Documentary", svc: "library", runtime: 30, status: "watched", rating: 4, moods: ["thoughtful", "cosy"], seasons: [[6, () => -120]], seen: { 1: [1, 6, -48, 2] }, finished: -38 },
  { title: "Sunday Bakes", genre: "Documentary", svc: "library", runtime: 40, status: "watchlist", moods: ["cosy", "light"], seasons: [[6, () => -60]], seen: {} },
];

export function demoState(today) {
  const r = rng(20261120);
  const s = blankState();
  Object.assign(s.profile, { name: "Mia", look: "popcorn", currency: "EUR", locale: "en-GB", together: true });
  s.people = [{ id: "benas", name: "Benas" }];
  s.services = [
    { id: "netflix", name: "Netflix", price: 13.99, cycle: "month", color: 0, paused: false },
    { id: "prime", name: "Prime Video", price: 8.99, cycle: "month", color: 1, paused: false },
    { id: "disney", name: "Disney+", price: 9.99, cycle: "month", color: 2, paused: false },
    { id: "library", name: "Library app", price: 0, cycle: "month", color: 3, paused: false },
  ];
  Object.assign(s.meta, { setupDone: true, unlocked: true, demo: true, lastBackup: addDays(today, -6) + "T19:00:00.000Z" });
  const d = n => addDays(today, Math.round(n));

  // Films you've watched: spread over the past year, a few this month.
  const recent = [-5, -11, -16, -19];
  WATCHED.forEach(([title, year, runtime, director, genre, moods, rating, marks, notes], i) => {
    const when = i < recent.length ? recent[i] : -24 - Math.round((i - recent.length) * 15.5 + r() * 9);
    const w = [{ date: d(when), with: r() < 0.6 ? ["benas"] : [] }];
    if (marks.includes("rewatch")) w.unshift({ date: d(when - 260), with: ["benas"] });
    if (title === "Nosferatu") w[w.length - 1] = { date: d(diffDays(today, `${today.slice(0, 4)}-10-31`) > 0 ? -380 : diffDays(today, `${today.slice(0, 4)}-10-31`)), with: ["benas"] };
    s.titles.push(newTitle({ kind: "film", title, year, runtime, director, genre, moods, rating, marks, notes, status: "watched", watches: w,
      ratings: w.some(x => x.with.length) ? { benas: Math.max(2, Math.min(5, rating + [-0.5, -0.25, 0, 0.25, 0.5][Math.floor(r() * 5)])) } : {},
      service: ["library", "netflix", "prime", "library"][i % 4], addedAt: d(when - 30 - r() * 60), with: w.some(x => x.with.length) ? ["benas"] : [] }));
  });
  WATCHLIST.forEach(([title, year, runtime, director, genre, moods, ago]) => {
    s.titles.push(newTitle({ kind: "film", title, year, runtime, director, genre, moods, status: "watchlist", addedAt: d(-ago), service: ago % 2 ? "library" : "" }));
  });

  // Series.
  for (const sh of SHOWS) {
    const seasons = sh.seasons.map(([count, sched], si) => ({ n: si + 1, episodes: Array.from({ length: count }, (_, k) => ({ n: k + 1, title: sh.names?.[si]?.[k] || "", airdate: d(sched(k + 1)), runtime: sh.runtime })) }));
    const seen = {};
    for (const [sn, [a, b, start, every]] of Object.entries(sh.seen || {})) for (let e = a; e <= b; e++) {
      const ep = seasons[sn - 1].episodes[e - 1], when = Math.max(start + (e - a) * every, -400);
      seen[epKey(Number(sn), e)] = ep.airdate > d(when) ? ep.airdate : d(Math.min(-1, when));
    }
    s.titles.push(newTitle({ kind: "series", title: sh.title, year: Number(seasons[0].episodes[0].airdate.slice(0, 4)), genre: sh.genre, runtime: sh.runtime, status: sh.status,
      rating: sh.rating || 0, marks: sh.marks || [], moods: sh.moods || [], service: sh.svc, seasons, seen, with: sh.with ? ["benas"] : [], at: sh.benas ? { benas: sh.benas } : {},
      ratings: sh.with ? { benas: Math.min(5, (sh.rating || 4) + 0.25) } : {}, finished: sh.finished ? d(sh.finished) : null, addedAt: d(Math.min(...Object.values(seen).map(v => diffDays(today, v)), -2) - 3),
      network: { netflix: "Netflix", prime: "Prime Video", disney: "Disney+", library: "Library app" }[sh.svc] }));
  }
  return s;
}

// The pretend search result in the demo (nothing goes online in the demo).
export const DEMO_RESULTS = [
  { kind: "film", title: "Our Town", year: 1940, runtime: 90, director: "Sam Wood", genre: "Drama", wikidata: "demo-our-town" },
  { kind: "series", title: "The Bramble Inn", year: 2025, network: "Netflix", genre: "Comedy", runtime: 30, tvmaze: null },
];
