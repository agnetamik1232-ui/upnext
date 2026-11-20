// Up Next — dates as "YYYY-MM-DD" strings in the viewer's own calendar. Pure functions (tested in Node).
const DAY = 86400000;
export const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = s => String(s).split("-").map(Number);
export const dayNum = s => { const [y, m, d] = parts(s); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const fromDayNum = n => { const t = new Date(n * DAY); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const diffDays = (a, b) => dayNum(b) - dayNum(a);
export const todayISO = (now = new Date()) => iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const yearOf = s => (s ? Number(String(s).slice(0, 4)) : null);
export const monthOf = s => String(s || "").slice(0, 7);
export const sum = (a, f = x => x) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const round2 = n => Math.round(n * 100) / 100;
export const weekday = s => new Date(Date.UTC(...parts(s).map((v, i) => (i === 1 ? v - 1 : v)))).getUTCDay(); // 0 = Sunday
