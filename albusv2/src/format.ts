/* Backend timestamps are naive UTC (no `Z` / offset). JS would parse such a
   string as *local* time and show it unshifted (i.e. as UTC). We tag it UTC
   when it carries no timezone designator, then render it in the browser's
   locale and timezone. */

function asUtc(s: string): string {
  // leave alone if it already has a Z or a +hh:mm / -hh:mm offset
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`;
}

export function formatLocalDateTime(s: string): string {
  return new Date(asUtc(s)).toLocaleString();
}

export function formatLocalDate(s: string): string {
  return new Date(asUtc(s)).toLocaleDateString();
}

/** Elapsed time since a timestamp, e.g. "0:42" or "12:07" (mm:ss, or h:mm:ss). */
export function elapsedSince(s: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(asUtc(s)).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/** Compact relative time, e.g. "just now", "3 min ago", "2 h ago", "4 d ago". */
export function timeAgo(s: string): string {
  const diffMs = Date.now() - new Date(asUtc(s)).getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
