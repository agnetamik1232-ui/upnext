// Up Next — the screens.
import * as W from "./watch.js";
import { app, esc, money, fd, fdLong, fdShort, fMonthShort, isIOS, isStandalone } from "./core.js";
import { addDays, diffDays, yearOf, sum } from "./dates.js";
import { poster, blankPoster, stars, hm, hours, whenLabel, statusText, svcById, svcColor, personById, genreColor, ICON, LOGO, STATUS_LABEL } from "./ui.js";
import { LOOKS } from "./looks.js";
import { CURRENCIES, MOODS } from "./model.js";

export const ETSY_URL = "https://dearagneta.etsy.com";
export const APP_VERSION = "1.0.0";
const NAV = [["home", "Home"], ["library", "Library"], ["night", "Movie night"], ["streaming", "Streaming"], ["stats", "Stats"]];
const S = () => app.S;
const open = t => `data-act="open-title" data-id="${t.id}"`;
const greet = () => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; };
const months = d => { const n = Math.round(Math.max(0, diffDays(d, app.today)) / 30.4); return n <= 1 ? (diffDays(d, app.today) < 21 ? "a few weeks" : "a month") : `${n} months`; };

export function shell() {
  const v = app.view, cur = k => (v === k || (k === "more" && ["streaming", "stats", "settings", "more"].includes(v)) ? ' aria-current="page"' : "");
  return `${app.demo && !app.photo ? `<div class="demo-bar"><span>Free demo with an example viewer. Try anything, nothing is saved.</span><a href="${ETSY_URL}" target="_blank" rel="noopener">Get Up Next</a></div>` : ""}
  <header class="top"><div class="top-in">
    <div class="logo fr">Up Next ${LOGO}</div>
    <nav class="nav" aria-label="Main">${NAV.map(([k, l]) => `<button type="button" data-act="nav" data-view="${k}"${v === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
    <div class="top-right"><button type="button" class="btn primary small add-top" data-act="add-title">+ Add a title</button><button type="button" class="chip" data-act="nav" data-view="settings"${v === "settings" ? ' aria-current="page"' : ""}>Settings</button></div>
  </div></header>
  <main class="main" id="main">${(views[v] || views.home)()}</main>
  <nav class="tabbar" aria-label="Main">
    <button type="button" data-act="nav" data-view="home"${cur("home")}>Home</button>
    <button type="button" data-act="nav" data-view="library"${cur("library")}>Library</button>
    <button type="button" class="add" data-act="add-title" aria-label="Add a title">Add</button>
    <button type="button" data-act="nav" data-view="night"${cur("night")}>Movie night</button>
    <button type="button" data-act="nav" data-view="more"${cur("more")}>More</button>
  </nav>`;
}

// ---------------- HOME ----------------
function home() {
  const P = S().profile;
  const hello = `<div class="hello"><div><div class="caps">${esc(fdLong(app.today))}</div><h1 class="fr">${P.name ? `Good ${greet()}, ${esc(P.name)}. ` : ""}<em class="it">Popcorn's ready.</em></h1></div><div class="script">just one more episode</div></div>`;
  if (!S().titles.length) return `${hello}<div class="grid"><section class="card s12 welcome"><h2>Your watchlist starts here</h2><p>Search for a series or a film and add it in two taps. Already use Letterboxd or IMDb? Bring your history over in one go.</p>
    <div class="row-btns"><button type="button" class="btn primary" data-act="add-title">Search a title</button><button type="button" class="btn ghost" data-act="import">Import from Letterboxd or IMDb</button></div></section></div>`;
  const now = W.watchingNow(S()), left = sum(now, t => W.seasonLeft(t, app.today).minutes);
  return `${hello}
  <div class="grid">
    <section class="card s8"><h3>Watching now <small>${now.length ? `${now.length} ${now.length === 1 ? "series" : "series"}${left ? ` · ${hm(left)} left this season` : ""}` : "nothing yet"}</small>${now.length > 3 ? `<button type="button" class="act" data-act="nav" data-view="library" data-filter="watching">See all</button>` : ""}</h3>
      ${now.length ? `<div class="shows">${now.slice(0, 3).map(showCard).join("")}</div>` : `<div class="empty">Start a series and its next episode waits here. <button type="button" class="btn text small" data-act="add-title">Find a series</button></div>`}
    </section>
    ${newEpisodesCard("s4")}
    ${nightCard(true)}
    ${monthCard()}
    ${streamingCard()}
    ${watchlistCard()}
  </div>${enrichNote()}`;
}

export function showCard(t) {
  const nx = W.nextEpisode(t, app.today), up = W.upcomingEpisode(t, app.today), p = W.progress(t, app.today), tg = S().profile.together && (t.with || []).length ? W.together(t, S().people, app.today) : null;
  const season = nx ? W.episodes(t).filter(e => e.s === nx.s) : [];
  const seasonSeen = season.filter(e => W.isSeen(t, e)).length;
  const line = nx ? `<div class="se">Next: ${W.epLabel(t, nx)}</div><div class="sub">Episode ${nx.e} of ${season.length}${nx.runtime || t.runtime ? ` · ${hm(W.epMinutes(t, nx))}` : ""}</div>`
    : `<div class="se">Caught up</div><div class="sub">${up ? (up.e === 1 ? `Season ${up.s} starts ${esc(fdShort(up.airdate))}` : `${W.epLabel(t, up)} on ${esc(fd(up.airdate))}`) : W.episodes(t).length ? "No new episodes announced" : "Add episodes on its page"}</div>`;
  return `<div class="show"><button type="button" class="cv" ${open(t)}>${poster(t, 92)}</button><div class="info"><b>${esc(t.title)}</b>${line}
    <div class="bar"><i style="width:${(nx ? (seasonSeen / Math.max(1, season.length)) * 100 : p.pct).toFixed(1)}%"></i></div>
    ${tg && tg.note ? `<div class="with">${esc(tg.note)}</div>` : ""}
    <div class="acts">${nx ? `<button type="button" class="btn primary small" data-act="ep-next" data-id="${t.id}">+1 episode</button>` : ""}<button type="button" class="btn text small" ${open(t)}>Episodes</button></div></div></div>`;
}

function newEpisodesCard(span) {
  const list = W.newEpisodes(S(), app.today).slice(0, 4);
  return `<section class="card ${span} tonight"><h3>New episodes${list.length ? `<button type="button" class="act" data-act="ics">Add to calendar</button>` : ""}</h3>
    ${list.length ? list.map(x => `<button type="button" class="row" ${open(x.t)}>${x.t.poster ? poster(x.t, 38) : blankPoster(x.t.genre)}<div><b>${esc(x.t.title)}</b><small>${x.seasonStart && x.ep.s > 1 ? `Season ${x.ep.s} starts` : `${W.epLabel(x.t, x.ep)}${x.ep.runtime ? ` · ${hm(x.ep.runtime)}` : ""}`}</small></div><div class="when">${esc(whenLabel(x.days, x.ep.airdate))}</div></button>`).join("")
      : `<div class="empty">Episodes of the series you follow appear here on the day they air.</div>`}
  </section>`;
}

// ---------------- MOVIE NIGHT ----------------
export function nightState() {
  if (!app.night) app.night = { minutes: 120, moods: [], noScary: true, comfort: false, who: ["me", ...S().people.slice(0, 1).map(p => p.id)], skip: [], pick: null };
  return app.night;
}
export function nightPick() {
  const n = nightState();
  const res = W.movieNight(S(), n, app.today);
  if (!n.pick || !S().titles.find(t => t.id === n.pick)) n.pick = res.pick?.id || null;
  return { pick: S().titles.find(t => t.id === n.pick) || null, count: res.count };
}
function nightCard(compact) {
  const n = nightState(), { pick, count } = nightPick();
  const chip = (act, v, on, label) => `<button type="button" class="chip pick${on ? " on" : ""}" data-act="${act}" data-v="${esc(v)}" aria-pressed="${on}">${label}</button>`;
  const people = [{ id: "me", name: S().profile.name || "Me" }, ...S().people];
  const moods = compact ? ["cosy", "funny", "romantic", "mystery"] : ["cosy", "funny", "romantic", "feel-good", "mystery", "tense", "emotional", "epic", "thoughtful", "light"];
  const meta = t => [t.year, t.runtime ? `${t.runtime} min` : "", t.genre.toLowerCase(), `on your list for ${months(t.addedAt || app.today)}`].filter(Boolean).join(" · ");
  const result = pick ? `<div class="pick-card">${poster(pick, compact ? 70 : 132)}<div class="pc-t"><div class="caps" style="color:var(--deep)">Tonight's pick</div><b class="fr">${esc(pick.title)}</b><small>${esc(meta(pick))}</small>
      <div class="row-btns" style="margin-top:auto"><button type="button" class="btn primary small" data-act="night-watch" data-id="${pick.id}">We'll watch it</button><button type="button" class="btn ghost small" data-act="night-again">Pick another</button></div></div></div>`
    : `<div class="empty">${S().titles.some(t => t.kind === "film" && t.status === "watchlist") ? "Nothing on your watchlist fits. Try a longer time or another mood." : "Add films to your watchlist and Up Next picks one for you."}</div>`;
  if (compact) return `<section class="card s4 night"><h3>Movie night <small>from your watchlist</small><button type="button" class="act" data-act="nav" data-view="night">More choices</button></h3>
    <div class="chips">${chip("night-time", n.minutes === 120 ? 0 : 120, n.minutes === 120, `${ICON.clock} under 2 h`)}${moods.map(m => chip("night-mood", m, n.moods.includes(m), m[0].toUpperCase() + m.slice(1))).join("")}${chip("night-scary", "", n.noScary, "Nothing scary")}</div>${result}</section>`;
  const next = W.watchingNow(S()).map(t => ({ t, nx: W.nextEpisode(t, app.today) })).filter(x => x.nx && (!n.minutes || W.epMinutes(x.t, x.nx) <= n.minutes)).slice(0, 3);
  return `<div class="grid"><section class="card s7 night big-night">
      <h2 class="fr" style="font-style:normal;font-size:1.6rem">What are we in the mood for?</h2><p class="muted" style="margin:-.5rem 0 1rem;font-weight:600">${count} ${count === 1 ? "film fits" : "films fit"}, picked from your watchlist.</p>
      <div class="caps">How long have we got?</div><div class="chips">${[[90, "90 min"], [120, "2 hours"], [150, "2½ hours"], [0, "Any"]].map(([v, l]) => chip("night-time", v, n.minutes === v, l)).join("")}</div>
      <div class="caps">Mood</div><div class="chips">${moods.map(m => chip("night-mood", m, n.moods.includes(m), m[0].toUpperCase() + m.slice(1))).join("")}${chip("night-scary", "", n.noScary, "Nothing scary")}</div>
      <div class="caps">Who's watching</div><div class="chips">${people.map(p => chip("night-who", p.id, n.who.includes(p.id), esc(p.name))).join("")}${chip("night-comfort", "", n.comfort, `${ICON.heart} Comfort rewatches too`)}</div>
    </section>
    <section class="card s5 night">${result}</section>
    ${next.length ? `<section class="card s12"><h3>Or keep going with a series</h3><div class="next-eps">${next.map(x => `<button type="button" class="ne" ${open(x.t)}>${poster(x.t, 60)}<div><b>${esc(x.t.title)}</b><small>${W.epLabel(x.t, x.nx)} · ${hm(W.epMinutes(x.t, x.nx))}</small></div></button>`).join("")}</div></section>` : ""}
  </div>`;
}
function night() { return `<h1 class="page-title fr">Movie night</h1><p class="page-sub">One pick, not forty minutes of scrolling. Tap "Pick another" as often as you like.</p>${nightCard(false)}`; }

// ---------------- CARDS ----------------
function monthCard() {
  const m = W.monthStats(S(), app.today), day = Number(app.today.slice(8)), weeks = m.weeks.filter(w => w.from <= day);
  const mx = Math.max(60, ...weeks.map(w => w.ep + w.film));
  return `<section class="card s4 month"><h3>${esc(fdLong(app.today).split(" ").pop())} so far<button type="button" class="act" data-act="nav" data-view="stats">Stats</button></h3>
    <div class="k"><div><b class="fr">${m.films}</b><small>${m.films === 1 ? "film" : "films"}</small></div><div><b class="fr">${m.episodes}</b><small>episodes</small></div><div><b class="fr">${hours(m.minutes)}</b><small>on screen</small></div></div>
    <div class="weeks">${weeks.map(w => `<div><i class="f" style="height:${(w.film / mx * 100).toFixed(1)}%"></i><i style="height:${(w.ep / mx * 100).toFixed(1)}%"></i></div>`).join("")}</div>
    <div class="wl">${weeks.map((w, i) => `<span>${i === weeks.length - 1 ? "Now" : `Week ${i + 1}`}</span>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--head)"></i>Episodes</span><span><i style="background:var(--gold)"></i>Films</span></div></section>`;
}
function streamingCard() {
  const r = W.serviceReport(S(), app.today), nudge = r.rows.find(x => x.nudge);
  if (!S().services.length) return `<section class="card s4"><h3>Streaming budget</h3><div class="empty">Add the services you pay for and see what each hour really costs.<br><button type="button" class="btn text small" data-act="svc-edit">Add a service</button></div></section>`;
  return `<section class="card s4"><h3>Streaming budget <small>${money(r.cost)} a month</small><button type="button" class="act" data-act="nav" data-view="streaming">Details</button></h3>
    <div class="svc"><span class="caps">Service</span><span class="caps r">30 days</span><span class="caps r">Per hour</span>
    ${r.rows.slice(0, 4).map(x => `<span class="n">${esc(x.svc.name)}${x.svc.paused ? " (paused)" : x.cost ? ` · ${money(x.svc.price)}` : ""}</span><span class="p">${hours(x.minutes)}</span><span class="c fr">${x.perHour != null ? money(x.perHour) : !x.svc.price && !x.svc.paused ? "free" : "&ndash;"}</span>`).join("")}</div>
    ${nudge ? `<div class="warn">You haven't opened ${esc(nudge.svc.name)} in ${Math.round(nudge.idleDays / 7)} weeks. Pause it and save ${money(nudge.cost)} a month?</div>` : ""}</section>`;
}
function watchlistCard() {
  const wl = W.watchlist(S()), films = wl.filter(t => t.kind === "film").length;
  return `<section class="card s12"><h3>Watchlist <small>${films} ${films === 1 ? "film" : "films"} · ${wl.length - films} series${wl[0] ? ` · longest wait: ${esc(wl[0].title)}, ${months(wl[0].addedAt || app.today)}` : ""}</small><button type="button" class="act" data-act="nav" data-view="library" data-filter="watchlist">Library</button></h3>
    <div class="strip">${wl.slice(0, 14).map(t => `<button type="button" class="cv" ${open(t)}>${poster(t, 104)}<span class="cap">${t.kind === "series" ? "Series" : "Film"}${t.year ? ` · ${t.year}` : ""}</span></button>`).join("") || `<div class="empty">Films and series you want to watch line up here.</div>`}</div></section>`;
}
function enrichNote() { return app.enrich ? `<div class="toastline">Filling in film details: ${app.enrich.done} of ${app.enrich.total}</div>` : ""; }

// ---------------- LIBRARY ----------------
export function libraryList() {
  const q = (app.libQuery || "").trim(), f = app.libFilter || "all", kind = app.libKind || "all", g = app.libGenre || "", sort = app.libSort || "recent";
  let list = S().titles.filter(t => (kind === "all" || t.kind === kind) && (f === "all" || t.status === f || (f === "comfort" && t.marks.includes("comfort watch"))) && (!g || t.genre === g));
  if (q) { const n = W.norm(q); list = list.filter(t => W.norm(t.title).includes(n) || W.norm(t.director).includes(n)); }
  const by = { recent: (a, b) => W.lastActivity(b).localeCompare(W.lastActivity(a)), title: (a, b) => W.norm(a.title).localeCompare(W.norm(b.title)), rating: (a, b) => (b.rating || 0) - (a.rating || 0), added: (a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""), year: (a, b) => (b.year || 0) - (a.year || 0) };
  return list.sort(by[sort] || by.recent);
}
export function libraryGrid() {
  const list = libraryList();
  if (!list.length) return `<div class="empty">${app.libQuery ? `Not in your library yet. <button type="button" class="btn text small" data-act="add-title" data-q="${esc(app.libQuery)}">Search for "${esc(app.libQuery)}"</button>` : "Nothing here yet."}</div>`;
  return list.map((t, i) => `<button type="button" class="cv tile-t" ${open(t)}>${poster(t, 132, "", i > 40)}<span class="tt">${esc(t.title)}</span><span class="ta">${esc(statusText(t))}${t.kind === "series" && t.status === "watching" ? ` · ${esc(W.epLabel(t, W.nextEpisode(t, app.today)) || "caught up")}` : ""}</span>${t.rating ? stars(t.rating, 12) : ""}</button>`).join("");
}
function library() {
  const f = app.libFilter || "all", kind = app.libKind || "all";
  const count = k => S().titles.filter(t => k === "all" || t.status === k).length;
  return `<h1 class="page-title fr">Library</h1><p class="page-sub">Every film and series you've watched, are watching, or want to.</p>
    <div class="seg" style="margin-bottom:.7rem">${[["all", "Everything"], ["series", "Series"], ["film", "Films"]].map(([k, l]) => `<button type="button" data-act="lib-kind" data-v="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}</div>
    <div class="seg" style="margin-bottom:.9rem">${[["all", "All"], ["watching", "Watching"], ["watchlist", "Watchlist"], ["watched", "Watched"], ["paused", "Paused"], ["dropped", "Stopped"], ["comfort", "Comfort watches"]].map(([k, l]) => `<button type="button" data-act="lib-filter" data-v="${k}" aria-pressed="${f === k}">${l}${k !== "comfort" ? ` <span class="muted">${count(k)}</span>` : ""}</button>`).join("")}</div>
    <div class="libbar"><input class="input" type="search" placeholder="Search your library" value="${esc(app.libQuery || "")}" data-live="lib-q" aria-label="Search your library">
      <select class="input" data-live="lib-genre" aria-label="Genre"><option value="">All genres</option>${S().genres.map(g => `<option${g === app.libGenre ? " selected" : ""}>${esc(g)}</option>`).join("")}</select>
      <select class="input" data-live="lib-sort" aria-label="Sort">${[["recent", "Recently watched"], ["added", "Recently added"], ["title", "Title A–Z"], ["rating", "Your rating"], ["year", "Newest first"]].map(([k, l]) => `<option value="${k}"${k === (app.libSort || "recent") ? " selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="wall" id="lib-grid">${libraryGrid()}</div>`;
}

// ---------------- STREAMING ----------------
function streaming() {
  const r = W.serviceReport(S(), app.today), Y = yearOf(app.today);
  const paid = S().titles.filter(t => t.price && (t.watches || []).some(w => w.date && w.date.startsWith(String(Y))));
  return `<h1 class="page-title fr">Streaming budget</h1><p class="page-sub">What you pay, what you actually watch, and what each hour costs you. Hours come from what you tick in Up Next.</p>
  <div class="kpis">
    <div class="card kpi"><span class="caps">Each month</span><b>${money(r.cost)}</b><small>${S().services.filter(s => s.paused).length ? `${S().services.filter(s => s.paused).length} paused` : "all services"}</small></div>
    <div class="card kpi"><span class="caps">Each year</span><b>${money(r.year, "r")}</b><small>at today's prices</small></div>
    <div class="card kpi"><span class="caps">Cost per hour</span><b>${r.perHour != null ? money(r.perHour) : "&ndash;"}</b><small>last 30 days</small></div>
    <div class="card kpi"><span class="caps">Watched</span><b>${hours(r.hours * 60)}</b><small>on paid services, 30 days</small></div>
  </div>
  ${r.rows.filter(x => x.nudge).map(x => `<div class="nudge"><b>${esc(x.svc.name)}</b> hasn't been opened since ${esc(fdShort(x.lastUsed))} (${Math.round(x.idleDays / 7)} weeks). Pausing it saves ${money(x.cost * 12, "r")} a year.<div class="row-btns" style="margin-top:.6rem"><button type="button" class="btn primary small" data-act="svc-pause" data-id="${x.svc.id}">I paused it</button><button type="button" class="btn ghost small" data-act="svc-keep" data-id="${x.svc.id}">Keep it</button></div></div>`).join("")}
  <div class="grid"><section class="card s8"><h3>Your services<button type="button" class="act" data-act="svc-edit">Add a service</button></h3>
    ${S().services.length ? `<div class="svc-list">${r.rows.map(x => `<button type="button" class="svcrow" data-act="svc-edit" data-id="${x.svc.id}"><span class="sqb" style="background:${svcColor(x.svc)}">${esc(x.svc.name[0] || "?")}</span><span class="t"><b>${esc(x.svc.name)}${x.svc.paused ? ` <span class="pill">paused</span>` : ""}</b><small>${x.svc.price ? `${money(x.svc.price)} a ${x.svc.cycle}` : "free"} · ${hours(x.minutes)} in 30 days · ${x.lastUsed ? `last used ${esc(fdShort(x.lastUsed))}` : "not used yet"}</small></span><span class="c"><b class="fr">${x.perHour != null ? money(x.perHour) : !x.svc.price && !x.svc.paused ? "free" : "&ndash;"}</b><small>${x.perHour != null ? "per hour" : ""}</small></span></button>`).join("")}</div>`
      : `<div class="empty">Add Netflix, Prime Video or whatever you pay for. Then pick the service on each title you watch.</div>`}
  </section>
  <section class="card s4"><h3>Tickets and rentals <small>${Y}</small></h3>
    ${paid.length ? `<div class="big fr">${money(sum(paid, t => t.price))}</div><p class="small muted">${paid.length} ${paid.length === 1 ? "film" : "films"} you paid for this year (cinema, rentals, buying).</p>` : `<div class="empty">Add a price on a film you paid to watch (cinema ticket, rental) and it adds up here.</div>`}
    <p class="small muted" style="margin-top:1rem">Want every subscription in one place, not only streaming? The Dear Agneta Subscription Tracker does that.</p></section></div>`;
}

// ---------------- STATS ----------------
function statsView() {
  const Y = app.statsYear || yearOf(app.today), st = W.yearStats(S(), Y);
  const years = [...new Set([yearOf(app.today), ...W.events(S()).map(e => yearOf(e.date))])].sort((a, b) => b - a);
  const mx = Math.max(60, ...st.months.map(m => m.minutes)), gm = Math.max(1, ...st.genres.map(g => g[1]));
  const svc = Object.entries(st.byService).map(([id, m]) => [svcById(id), m]).filter(x => x[0]).sort((a, b) => b[1] - a[1]);
  const top = S().titles.filter(t => t.rating >= 4.5 && W.lastActivity(t).startsWith(String(Y))).sort((a, b) => b.rating - a.rating).slice(0, 8);
  return `<div class="hello"><div><h1 class="page-title fr" style="margin:0">Your ${Y} on screen</h1></div><div class="row-btns"><select class="input" data-live="stats-year" aria-label="Year" style="width:auto">${years.map(y => `<option${y === Y ? " selected" : ""}>${y}</option>`).join("")}</select><button type="button" class="btn primary small" data-act="year-card" data-year="${Y}">Your year card</button></div></div>
  <div class="kpis">
    <div class="card kpi"><span class="caps">Films</span><b>${st.films}</b><small>${st.loved} rated 4½ stars or more</small></div>
    <div class="card kpi"><span class="caps">Episodes</span><b>${st.episodes}</b><small>${st.showsFinished} ${st.showsFinished === 1 ? "series" : "series"} finished</small></div>
    <div class="card kpi"><span class="caps">On screen</span><b>${st.hours} h</b><small>about ${Math.round(st.hours / Math.max(1, (Y === yearOf(app.today) ? diffDays(`${Y}-01-01`, app.today) + 1 : 365) / 7))} h a week</small></div>
    <div class="card kpi"><span class="caps">Average rating</span><b>${st.avgRating ?? "&ndash;"}</b><small>films you rated</small></div>
  </div>
  <div class="grid">
    <section class="card s8"><h3>Hours each month</h3><div class="months">${st.months.map((m, i) => `<div class="mbar"><b>${m.minutes ? Math.round(m.minutes / 60) : ""}</b><i style="height:${(m.minutes / mx * 100).toFixed(1)}%"></i><span>${esc(fMonthShort(`${Y}-${String(i + 1).padStart(2, "0")}`))}</span></div>`).join("")}</div>
      ${st.busiest != null ? `<p class="small muted" style="margin-top:.6rem">Busiest month: ${esc(new Date(Date.UTC(Y, st.busiest, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" }))}.</p>` : ""}</section>
    <section class="card s4"><h3>Highlights</h3>
      ${st.binge ? `<div class="hl"><span class="caps">Most-binged series</span><button type="button" class="hl-row" ${open(st.binge.t)}>${poster(st.binge.t, 48)}<b>${esc(st.binge.t.title)}<small>${st.binge.n} episodes this year</small></b></button></div>` : ""}
      ${st.fav ? `<div class="hl"><span class="caps">Favourite film</span><button type="button" class="hl-row" ${open(st.fav)}>${poster(st.fav, 48)}<b>${esc(st.fav.title)}<small>${stars(st.fav.rating, 13)}</small></b></button></div>` : ""}
      ${!st.binge && !st.fav ? `<div class="empty">Watch something and your highlights appear here.</div>` : ""}</section>
    <section class="card s6"><h3>Genres <small>by hours</small></h3>${st.genres.slice(0, 7).map(([g, m]) => `<div class="gbar"><span class="sq" style="background:${genreColor(g)}"></span><b>${esc(g)}</b><em>${hours(m)}</em><div class="bar"><i style="width:${(m / gm * 100).toFixed(1)}%;background:${genreColor(g)}"></i></div></div>`).join("") || `<div class="empty">No hours yet this year.</div>`}</section>
    <section class="card s6"><h3>Where you watched <small>by hours</small></h3>${svc.map(([s, m]) => `<div class="gbar"><span class="sq" style="background:${svcColor(s)}"></span><b>${esc(s.name)}</b><em>${hours(m)}</em><div class="bar"><i style="width:${(m / Math.max(1, svc[0][1]) * 100).toFixed(1)}%;background:${svcColor(s)}"></i></div></div>`).join("") || `<div class="empty">Pick a service on your titles to see this.</div>`}</section>
    <section class="card s12"><h3>Your favourites this year</h3><div class="strip">${top.map(t => `<button type="button" class="cv" ${open(t)}>${poster(t, 104)}${stars(t.rating, 12)}</button>`).join("") || `<div class="empty">Titles you rate 4½ stars or more show up here.</div>`}</div></section>
  </div>`;
}

// ---------------- SETTINGS ----------------
function settings() {
  const P = S().profile;
  return `<h1 class="page-title fr">Settings</h1><p class="page-sub">Your look, the people you watch with, and your data.</p>
  <div class="grid">
    <section class="card s6"><h2>Look</h2><div class="looks">${Object.entries(LOOKS).map(([k, l]) => `<button type="button" class="look" data-act="set-look" data-v="${k}" aria-pressed="${P.look === k}" style="--sw:${l.swatch};--pp:${l.paper}"><i></i>${esc(l.name)}</button>`).join("")}</div>
      <div style="margin-top:1rem"><button type="button" class="toggle" data-act="set-big" aria-pressed="${P.bigText}"><i></i>Bigger text</button><br>
        <button type="button" class="toggle" data-act="set-easy" aria-pressed="${P.easyFont}"><i></i>Easy-reading font</button><br>
        <button type="button" class="toggle" data-act="set-spoilers" aria-pressed="${P.spoilers}"><i></i>Show episode titles before I watch them</button><br>
        <button type="button" class="toggle" data-act="set-together" aria-pressed="${P.together}"><i></i>Watch-together progress</button></div>
    </section>
    <section class="card s6"><h2>You and who you watch with</h2>
      <form data-form="profile">
        <label class="field"><span>Your name (optional)</span><input class="input" name="name" value="${esc(P.name)}" autocomplete="given-name"></label>
        <div class="row2"><label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === P.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label class="field"><span>Date style</span><select class="input" name="locale">${[["en-GB", "20 Nov 2026"], ["en-US", "Nov 20, 2026"], ["de-DE", "20. Nov. 2026"], ["fr-FR", "20 nov. 2026"], ["lt-LT", "2026 lapkr. 20"], ["nl-NL", "20 nov 2026"]].map(([l, d]) => `<option value="${l}"${l === P.locale ? " selected" : ""}>${d}</option>`).join("")}</select></label></div>
        <button class="btn primary" type="submit">Save</button>
      </form>
      <div class="people">${S().people.map(p => `<span class="chip">${ICON.people} ${esc(p.name)}<button type="button" class="x" data-act="person-del" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">&times;</button></span>`).join("")}<button type="button" class="btn soft small" data-act="person-add">+ Someone you watch with</button></div>
    </section>
    <section class="card s6"><h2>Your history <small>only on this device</small></h2>
      <div class="sumline"><span>Import from Letterboxd or IMDb</span><button type="button" class="btn soft small" data-act="import">Import</button></div>
      <div class="sumline"><span>Back up<span class="small muted" style="display:block;font-weight:600">A small file to keep in Files, Drive or email. Do it weekly.</span></span><button type="button" class="btn soft small" data-act="backup">Back up now</button></div>
      <div class="sumline"><span>Restore from a backup</span><button type="button" class="btn text small" data-act="restore">Choose file</button></div>
      <div class="sumline"><span>Move to my phone or laptop</span><button type="button" class="btn text small" data-act="move-phone">How</button></div>
      <div class="sumline"><span>Export for Google Sheets / Excel</span><button type="button" class="btn text small" data-act="export-csv">Export</button></div>
      <div class="sumline"><span>New episodes in my phone calendar</span><button type="button" class="btn text small" data-act="ics">Get file</button></div>
      <div class="sumline"><span>Streaming services and prices</span><button type="button" class="btn text small" data-act="nav" data-view="streaming">Open</button></div>
    </section>
    <section class="card s6"><h2>Help</h2>
      <div class="sumline"><span>Put Up Next on my home screen</span><button type="button" class="btn text small" data-act="install-help">Show me</button></div>
      <div class="sumline"><span>Questions or ideas</span><a class="btn text small" href="${ETSY_URL}" target="_blank" rel="noopener">Message Dear Agneta</a></div>
      ${app.demo ? "" : `<div class="sumline"><span>Start over (erase everything on this device)</span><button type="button" class="btn danger small" data-act="erase">Erase</button></div>`}
      <p class="small muted" style="margin-top:.8rem">Up Next ${APP_VERSION} &middot; by Dear Agneta &middot; series data and posters from <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVmaze</a> (CC BY-SA) &middot; film details from <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> (CC0).</p>
    </section>
  </div>`;
}

function more() {
  return `<h1 class="page-title fr">More</h1><div class="stack">
    <button type="button" class="opt" data-act="nav" data-view="streaming"><div class="t"><b>Streaming budget</b></div><small>What each service costs per hour you watch</small></button>
    <button type="button" class="opt" data-act="nav" data-view="stats"><div class="t"><b>Stats</b></div><small>Your year on screen, and your year card</small></button>
    <button type="button" class="opt" data-act="nav" data-view="library" data-filter="watchlist"><div class="t"><b>Watchlist</b></div><small>Everything you want to watch</small></button>
    <button type="button" class="opt" data-act="nav" data-view="settings"><div class="t"><b>Settings</b></div><small>Look, people, import, backup, help</small></button>
    ${!isStandalone() && isIOS() ? `<button type="button" class="opt" data-act="install-help"><div class="t"><b>Put it on my home screen</b></div><small>So it opens like an app and keeps your history safe</small></button>` : ""}
  </div>`;
}

export const views = { home, library, night, streaming, stats: statsView, settings, more };
