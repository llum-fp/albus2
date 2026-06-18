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

/** Format duration in minutes, e.g. 90 → "1h 30min", 10 → "10 min". */
export function formatDuration(min: number | null | undefined): string | null {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

/** Format build duration from seconds, e.g. 319 → "5m 19s", 45 → "45s". */
export function formatBuildDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Compact token count, e.g. 226675 → "227K", 1500000 → "1.5M". */
export function formatTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
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
