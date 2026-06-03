import { useEffect, useState } from "react";
import {
  adminFetchCourses,
  adminFetchSurveys,
  type SurveyRecord,
  type SurveyStats,
} from "../api";
import { RefreshCw } from "./icons";
import { formatLocalDateTime as fmtDate } from "../format";

const RATING_LABELS: Record<string, string> = {
  rating_overall: "Overall",
  rating_content: "Content",
  rating_albus: "Albus",
  rating_applicability: "Applicability",
};

export default function AdminSurveys() {
  const [stats, setStats] = useState<SurveyStats[]>([]);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
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

  useEffect(() => {
    refresh();
  }, []);

  const titleOf = (courseId: string) => titles[courseId] ?? courseId;
  const comments = records.filter((r) => r.comments && r.comments.trim());

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
          <div className="stat-grid">
            {stats.map((s) => (
              <div key={s.course_id} className="stat-card">
                <div className="stat-course">{titleOf(s.course_id)}</div>
                <div className="stat-count">
                  {s.count} response{s.count > 1 ? "s" : ""}
                </div>
                {Object.entries(RATING_LABELS).map(([key, label]) => {
                  const val = s.averages[key] ?? 0;
                  return (
                    <div key={key} className="stat-row">
                      <span className="stat-label">{label}</span>
                      <span className="stat-bar">
                        <span style={{ width: `${(val / 5) * 100}%` }} />
                      </span>
                      <span className="stat-val">{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {comments.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: "0.5rem 0 0.75rem" }}>Comments</p>
              {comments.map((r) => (
                <div key={r.id} className="comment-item">
                  <div className="meta">
                    {titleOf(r.course_id)} · {r.user} · {fmtDate(r.submitted_at)}
                  </div>
                  {r.comments}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
