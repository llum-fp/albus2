import { useEffect, useState } from "react";
import {
  adminFetchCourses,
  adminFetchSurveys,
  type SurveyRecord,
  type SurveyStats,
} from "../api";
import { RefreshCw, ChevronDown, ChevronRight } from "./icons";
import { formatLocalDateTime as fmtDate } from "../format";

const RATING_KEYS = ["rating_overall", "rating_content", "rating_albus", "rating_applicability"] as const;
const RATING_LABELS: Record<string, string> = {
  rating_overall: "Overall",
  rating_content: "Content",
  rating_albus: "Albus",
  rating_applicability: "Applicability",
};
const DIFF_LABEL: Record<string, string> = {
  muy_facil: "Very easy",
  facil: "Easy",
  adecuada: "Just right",
  dificil: "Hard",
  muy_dificil: "Very hard",
};
const DUR_LABEL: Record<string, string> = {
  corta: "Too short",
  adecuada: "Just right",
  larga: "Too long",
};

type SortKey = "course" | "count" | "rating_overall" | "rating_content" | "rating_albus" | "rating_applicability";

function dominant(dist: Record<string, number>): string {
  const entries = Object.entries(dist ?? {});
  if (!entries.length) return "—";
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function ratingColor(v: number): string {
  if (v >= 4) return "var(--oa-success)";
  if (v >= 3) return "var(--oa-warning)";
  return "var(--oa-red)";
}
function diffColor(k: string): string {
  if (["dificil", "muy_dificil"].includes(k)) return "var(--oa-red)";
  if (k === "adecuada") return "var(--oa-success)";
  return "var(--oa-warning)";
}
function durColor(k: string): string {
  return k === "adecuada" ? "var(--oa-success)" : "var(--oa-warning)";
}

export default function AdminSurveys() {
  const [stats, setStats] = useState<SurveyStats[]>([]);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commentFilter, setCommentFilter] = useState("all");

  const refresh = async () => {
    setLoading(true);
    try {
      const [surveys, courses] = await Promise.all([adminFetchSurveys(), adminFetchCourses()]);
      setStats(surveys.stats);
      setRecords(surveys.records);
      setTitles(Object.fromEntries(courses.map((c) => [c.id, c.title ?? c.id])));
      setError(null);
    } catch {
      setError("Couldn't load survey feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const titleOf = (id: string) => titles[id] ?? id;

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalResponses = stats.reduce((s, c) => s + c.count, 0);
  const globalAvg = stats.length
    ? stats.reduce((s, c) => s + (c.averages.rating_overall ?? 0), 0) / stats.length
    : 0;
  const qualified = stats.filter((s) => s.count >= 2);
  const bestCourse = qualified.length
    ? [...qualified].sort((a, b) => (b.averages.rating_overall ?? 0) - (a.averages.rating_overall ?? 0))[0]
    : stats[0];
  const mostResponded = stats.length
    ? [...stats].sort((a, b) => b.count - a.count)[0]
    : null;

  // ── Sorting ─────────────────────────────────────────────────────────────────
  const sort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortedStats = [...stats].sort((a, b) => {
    let av: number | string, bv: number | string;
    if (sortKey === "course") {
      av = titleOf(a.course_id).toLowerCase();
      bv = titleOf(b.course_id).toLowerCase();
    } else if (sortKey === "count") {
      av = a.count; bv = b.count;
    } else {
      av = a.averages[sortKey] ?? 0;
      bv = b.averages[sortKey] ?? 0;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  // ── Comments ────────────────────────────────────────────────────────────────
  const allComments = records.filter((r) => r.comments?.trim());
  const filteredComments =
    commentFilter === "all" ? allComments : allComments.filter((r) => r.course_id === commentFilter);
  const coursesWithComments = stats.filter((s) =>
    allComments.some((r) => r.course_id === s.course_id),
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Surveys</h2>
          <p className="sub">End-of-course feedback from learners.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {loading ? (
        <div className="admin-loading">Loading feedback…</div>
      ) : stats.length === 0 ? (
        <div className="admin-empty">No survey responses yet.</div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="survey-kpis">
            <div className="survey-kpi">
              <span className="kpi-value">{totalResponses}</span>
              <span className="kpi-label">Total responses</span>
            </div>
            <div className="survey-kpi">
              <span className="kpi-value" style={{ color: ratingColor(globalAvg) }}>
                {globalAvg.toFixed(1)}<span className="kpi-of">/5</span>
              </span>
              <span className="kpi-label">Avg overall rating</span>
            </div>
            {bestCourse && (
              <div className="survey-kpi">
                <span className="kpi-value kpi-title" title={titleOf(bestCourse.course_id)}>
                  {titleOf(bestCourse.course_id)}
                </span>
                <span className="kpi-label">
                  Best rated · {(bestCourse.averages.rating_overall ?? 0).toFixed(1)}/5
                </span>
              </div>
            )}
            {mostResponded && (
              <div className="survey-kpi">
                <span className="kpi-value kpi-title" title={titleOf(mostResponded.course_id)}>
                  {titleOf(mostResponded.course_id)}
                </span>
                <span className="kpi-label">Most responded · {mostResponded.count} responses</span>
              </div>
            )}
          </div>

          {/* ── Table ── */}
          <div className="survey-table-wrap">
            <table className="survey-table">
              <thead>
                <tr>
                  {(
                    [
                      ["course", "Course"],
                      ["count", "Responses"],
                      ["rating_overall", "Overall"],
                      ["rating_content", "Content"],
                      ["rating_albus", "Albus"],
                      ["rating_applicability", "Applicability"],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th key={key} onClick={() => sort(key)} className={sortKey === key ? "active" : ""}>
                      {label}{sortArrow(key)}
                    </th>
                  ))}
                  <th>Difficulty</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((s) => {
                  const domDiff = dominant(s.difficulty);
                  const domDur = dominant(s.duration);
                  const isExpanded = expanded === s.course_id;
                  return (
                    <>
                      <tr
                        key={s.course_id}
                        className={`survey-row${isExpanded ? " expanded" : ""}`}
                        onClick={() => setExpanded(isExpanded ? null : s.course_id)}
                      >
                        <td className="survey-name-cell">
                          <span className="survey-expand-icon">
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </span>
                          {titleOf(s.course_id)}
                        </td>
                        <td className="num-cell">{s.count}</td>
                        {RATING_KEYS.map((k) => {
                          const v = s.averages[k] ?? 0;
                          return (
                            <td key={k} className="rating-cell">
                              <span style={{ color: ratingColor(v) }}>{v.toFixed(1)}</span>
                              <span className="rating-track">
                                <span className="rating-fill" style={{ width: `${(v / 5) * 100}%`, background: ratingColor(v) }} />
                              </span>
                            </td>
                          );
                        })}
                        <td>
                          <span className="dist-pill" style={{ color: diffColor(domDiff) }}>
                            {DIFF_LABEL[domDiff] ?? domDiff}
                          </span>
                        </td>
                        <td>
                          <span className="dist-pill" style={{ color: durColor(domDur) }}>
                            {DUR_LABEL[domDur] ?? domDur}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${s.course_id}-expand`} className="expand-row">
                          <td colSpan={9}>
                            <div className="expand-content">
                              <div className="expand-section">
                                <div className="expand-title">Difficulty</div>
                                {Object.entries(s.difficulty).map(([k, v]) => (
                                  <div key={k} className="dist-bar-row">
                                    <span>{DIFF_LABEL[k] ?? k}</span>
                                    <div className="dist-bar-track">
                                      <div
                                        className="dist-bar-fill"
                                        style={{ width: `${(v / s.count) * 100}%`, background: diffColor(k) }}
                                      />
                                    </div>
                                    <span className="dist-count">{v}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="expand-section">
                                <div className="expand-title">Duration</div>
                                {Object.entries(s.duration).map(([k, v]) => (
                                  <div key={k} className="dist-bar-row">
                                    <span>{DUR_LABEL[k] ?? k}</span>
                                    <div className="dist-bar-track">
                                      <div
                                        className="dist-bar-fill"
                                        style={{ width: `${(v / s.count) * 100}%`, background: durColor(k) }}
                                      />
                                    </div>
                                    <span className="dist-count">{v}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="expand-section">
                                <div className="expand-title">Ratings breakdown</div>
                                {RATING_KEYS.map((k) => {
                                  const v = s.averages[k] ?? 0;
                                  return (
                                    <div key={k} className="dist-bar-row">
                                      <span>{RATING_LABELS[k]}</span>
                                      <div className="dist-bar-track">
                                        <div
                                          className="dist-bar-fill"
                                          style={{ width: `${(v / 5) * 100}%`, background: ratingColor(v) }}
                                        />
                                      </div>
                                      <span className="dist-count" style={{ color: ratingColor(v) }}>
                                        {v.toFixed(1)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Comments ── */}
          {allComments.length > 0 && (
            <>
              <div className="survey-comments-head">
                <p className="eyebrow">Comments</p>
                {coursesWithComments.length > 1 && (
                  <div className="select-wrap" style={{ width: "auto", minWidth: 200 }}>
                    <select
                      className="select"
                      value={commentFilter}
                      onChange={(e) => setCommentFilter(e.target.value)}
                    >
                      <option value="all">All courses ({allComments.length})</option>
                      {coursesWithComments.map((s) => {
                        const n = allComments.filter((r) => r.course_id === s.course_id).length;
                        return (
                          <option key={s.course_id} value={s.course_id}>
                            {titleOf(s.course_id)} ({n})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
              <div className="comment-list">
                {filteredComments.map((r) => (
                  <div key={r.id} className="comment-item">
                    <div className="comment-meta">
                      <div className="comment-meta-left">
                        <span className="comment-course">{titleOf(r.course_id)}</span>
                        <span className="comment-user">{r.user}</span>
                        <span className="comment-date">{fmtDate(r.submitted_at)}</span>
                      </div>
                      <div className="comment-ratings">
                        {RATING_KEYS.map((k) => {
                          const v = r[k as keyof SurveyRecord] as number;
                          return (
                            <span key={k} className="comment-rating" style={{ color: ratingColor(v) }}>
                              {RATING_LABELS[k]} {v}/5
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="comment-text">"{r.comments}"</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
