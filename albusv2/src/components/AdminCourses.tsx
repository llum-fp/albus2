import { useCallback, useEffect, useState } from "react";
import {
  adminCreateCourse,
  adminFetchCourse,
  adminFetchCourses,
  adminPublish,
  adminReviseCourse,
  adminUnpublish,
  findPage,
  findPages,
  type AdminCourse,
  type AdminCourseDetail,
  type ConfluencePage,
  type CourseProfile,
} from "../api";
import { useAdminJobs } from "../useAdminJobs";
import { Check, ChevronDown, Eye, Globe, GraduationCap, Pencil, Plus, RefreshCw, Search, X } from "./icons";
import { formatLocalDateTime as fmtDate, timeAgo } from "../format";

const STATUS_FILTERS = ["all", "published", "draft", "pending", "failed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function AdminCourses({
  onOpenCourse,
}: {
  onOpenCourse: (courseId: string) => void;
}) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showNew, setShowNew] = useState(false);
  const [revise, setRevise] = useState<AdminCourse | null>(null);
  const [preview, setPreview] = useState<AdminCourseDetail | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Builds launched from this browser session — kept in the monitor (so the
  // finished result lingers) until dismissed.
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { jobs, refresh: refreshJobs } = useAdminJobs();

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetchCourses();
      setCourses(data);
      setError(null);
    } catch {
      setError("Couldn't load courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Whenever the set of running builds changes (a build starts or finishes),
  // refresh the courses table so the new/updated course shows up.
  const runningKey = jobs.filter((j) => j.running).map((j) => j.db_id).join(",");
  useEffect(() => {
    refresh();
  }, [runningKey, refresh]);

  const watch = (dbId: number) => {
    setWatched((s) => new Set(s).add(dbId));
    setDismissed((s) => {
      const n = new Set(s);
      n.delete(dbId);
      return n;
    });
    refreshJobs();
  };

  // Monitor rows: anything currently running, plus builds we launched that have
  // since settled (until dismissed). Idle → the panel hides itself.
  const monitorJobs = jobs.filter(
    (j) => (j.running || watched.has(j.db_id)) && !dismissed.has(j.db_id),
  );

  const profiles = Array.from(new Set(courses.map((c) => c.profile).filter(Boolean))) as string[];

  const visible = courses.filter((c) => {
    if (profileFilter !== "all" && (c.profile ?? "") !== profileFilter) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "published") return c.published;
    if (statusFilter === "draft") return !c.published && c.status === "completed";
    return c.status === statusFilter;
  });

  const togglePublish = async (c: AdminCourse) => {
    setBusyId(c.db_id);
    try {
      const updated = c.published ? await adminUnpublish(c.db_id) : await adminPublish(c.db_id);
      setCourses((cur) => cur.map((x) => (x.db_id === c.db_id ? { ...x, ...updated } : x)));
    } catch {
      setError("Couldn't change publication state.");
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (c: AdminCourse) => {
    setBusyId(c.db_id);
    try {
      setPreview(await adminFetchCourse(c.db_id));
    } catch {
      setError("Couldn't load course preview.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Courses</h2>
          <p className="sub">Create, revise and publish catalog courses.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary btn-sm" onClick={refresh}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New course
          </button>
        </div>
      </div>

      {monitorJobs.length > 0 && (
        <div className="builds-monitor">
          <div className="builds-monitor-head">Active builds</div>
          {monitorJobs.map((j) => (
            <div className="build-row" key={j.db_id}>
              <span className="build-status">
                {j.running ? (
                  <span className="spin"><RefreshCw size={15} /></span>
                ) : j.status === "completed" ? (
                  <Check size={15} className="md-warn" style={{ color: "var(--oa-success)" }} />
                ) : (
                  <X size={15} style={{ color: "var(--oa-error)" }} />
                )}
              </span>
              <span className="build-title">
                {j.running ? (
                  <>Building… {j.title ?? (j.page_id ? `page ${j.page_id.join(", ")}` : "new course")}</>
                ) : (
                  j.title ?? "Course"
                )}
              </span>
              <span className="build-meta">
                {j.running
                  ? j.page_id
                    ? `page ${j.page_id.join(", ")}`
                    : ""
                  : `${j.status} · ${timeAgo(j.updated_at)}`}
              </span>
              {!j.running && (
                <button
                  className="icon-btn"
                  title="Dismiss"
                  onClick={() => setDismissed((s) => new Set(s).add(j.db_id))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="admin-toolbar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
        {profiles.length > 0 && (
          <>
            <span style={{ width: 1, height: 20, background: "var(--oa-border)", margin: "0 0.3rem" }} />
            <button
              className={`chip ${profileFilter === "all" ? "active" : ""}`}
              onClick={() => setProfileFilter("all")}
            >
              all profiles
            </button>
            {profiles.map((p) => (
              <button
                key={p}
                className={`chip ${profileFilter === p ? "active" : ""}`}
                onClick={() => setProfileFilter(p)}
              >
                {p}
              </button>
            ))}
          </>
        )}
      </div>

      {error && <p className="admin-error">{error}</p>}

      {loading ? (
        <div className="admin-loading">Loading courses…</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty">No courses match the current filters.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Profile</th>
                <th>Build</th>
                <th>Published</th>
                <th>Mod / Les</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.db_id}>
                  <td className="cell-title">{c.title ?? <span className="cell-muted">Untitled</span>}</td>
                  <td>
                    {c.profile ? (
                      <span className="badge badge-profile">{c.profile}</span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <span className={`badge ${c.published ? "badge-published" : "badge-draft"}`}>
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="cell-muted">{c.module_count} / {c.lesson_count}</td>
                  <td className="cell-muted">{fmtDate(c.updated_at)}</td>
                  <td className="cell-actions">
                    <button
                      className="icon-btn"
                      title="View as learner"
                      disabled={c.status !== "completed"}
                      onClick={() => onOpenCourse(c.id)}
                    >
                      <GraduationCap size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Preview outline"
                      disabled={busyId === c.db_id || c.status !== "completed"}
                      onClick={() => openPreview(c)}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Revise with feedback"
                      disabled={!c.session_id || c.status === "pending"}
                      onClick={() => setRevise(c)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title={c.published ? "Unpublish" : "Publish"}
                      disabled={busyId === c.db_id || c.status !== "completed"}
                      onClick={() => togglePublish(c)}
                    >
                      <Globe size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewCourseModal
          onClose={() => setShowNew(false)}
          onCreated={(dbId) => {
            setShowNew(false);
            watch(dbId);
            refresh();
          }}
        />
      )}
      {revise && (
        <ReviseModal
          course={revise}
          onClose={() => setRevise(null)}
          onSubmitted={(dbId) => {
            setRevise(null);
            watch(dbId);
            refresh();
          }}
        />
      )}
      {preview && <PreviewModal detail={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

/* ── New course modal ─────────────────────────────────────────────────── */
function NewCourseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (dbId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConfluencePage[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConfluencePage[]>([]);
  const [profile, setProfile] = useState<CourseProfile>("technical");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounced search as you type (from 3 chars). One box, two modes: an all-digit
  // query is treated as a Confluence page id (exact lookup); anything else is a
  // title/text search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      // Always search by title/text. If the query is all digits, also try an
      // exact page-id lookup (Confluence ids are exact keys — no prefix match,
      // so a partial id can only surface via the title search) and put any exact
      // hit first.
      const byText = findPages(q, 8);
      const byId = /^\d+$/.test(q)
        ? findPage(q).then((p) => (p ? [p] : [])).catch(() => [])
        : Promise.resolve<ConfluencePage[]>([]);
      Promise.all([byId, byText])
        .then(([idHits, textHits]) => {
          const seen = new Set(idHits.map((p) => String(p.page_id)));
          setResults([...idHits, ...textHits.filter((p) => !seen.has(String(p.page_id)))]);
          setSearchErr(null);
        })
        .catch(() => setSearchErr("Search failed."))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const isSelected = (p: ConfluencePage) => selected.some((x) => x.page_id === p.page_id);
  const toggle = (p: ConfluencePage) =>
    setSelected((cur) =>
      isSelected(p) ? cur.filter((x) => x.page_id !== p.page_id) : [...cur, p],
    );

  const submit = async () => {
    const ids = Array.from(new Set(selected.map((p) => String(p.page_id))));
    if (ids.length === 0) {
      setErr("Pick at least one page.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const res = await adminCreateCourse({
        page_id: ids.length === 1 ? ids[0] : ids,
        profile,
        topic: topic.trim() || undefined,
        duration_min: duration ? Number(duration) : undefined,
      });
      onCreated(res.db_id);
    } catch {
      setErr("Couldn't start the build.");
      setSending(false);
    }
  };

  const showPanel = query.trim().length >= 3;

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className={`new-course-wrap ${showPanel ? "has-panel" : ""}`}>
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>New course</h3>
        <p className="modal-sub">
          Search Confluence and pick the source page(s). Builds in the background (5–30 min);
          starts as a Draft and shows in the Active builds monitor.
        </p>

        <div className="field">
          <label>Topic (what the course should focus on within the pages)</label>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Troubleshooting & version upgrade"
          />
        </div>

        <div className="field">
          <label>Source pages</label>
          {selected.length > 0 && (
            <div className="selected-pages">
              {selected.map((p) => (
                <span className="page-chip" key={p.page_id}>
                  {p.page_title || p.page_id}
                  <button className="page-chip-x" onClick={() => toggle(p)} title="Remove">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, or paste a page id…"
            />
            {searching && <span className="spin search-spin"><RefreshCw size={14} /></span>}
          </div>
        </div>

        <div className="field">
          <label>Profile</label>
          <div className="select-wrap">
            <select className="select" value={profile} onChange={(e) => setProfile(e.target.value as CourseProfile)}>
              <option value="technical">Technical</option>
              <option value="sales">Sales</option>
            </select>
            <ChevronDown size={16} className="select-caret" />
          </div>
        </div>
        <div className="field">
          <label>Target duration in minutes (optional)</label>
          <input
            className="input"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 60"
          />
        </div>

        {err && <p className="admin-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={sending}>
            {sending ? "Starting…" : "Start build"}
          </button>
        </div>
      </div>

      {showPanel && (
        <aside className="page-panel">
          <div className="panel-head">
            <Search size={14} /> Confluence pages
            {searching && (
              <span className="spin" style={{ marginLeft: "auto" }}><RefreshCw size={13} /></span>
            )}
          </div>
          <div className="page-panel-body">
            {searchErr && <p className="admin-error">{searchErr}</p>}
            {!searching && results.length === 0 && !searchErr && (
              <p className="search-hint">No match — try other words or a page id.</p>
            )}
            {results.length > 0 && (
              <div className="page-results flush">
                {results.map((p) => (
                  <button
                    key={p.page_id}
                    className={`page-result ${isSelected(p) ? "selected" : ""}`}
                    onClick={() => toggle(p)}
                  >
                    <span className="page-result-check">{isSelected(p) ? <Check size={14} /> : null}</span>
                    <span className="page-result-body">
                      <span className="page-result-title">
                        {p.page_title || "(untitled)"} <span className="cell-muted">· {p.page_id}</span>
                      </span>
                      {p.brief_description && (
                        <span className="page-result-desc">{p.brief_description}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}

/* ── Revise modal ─────────────────────────────────────────────────────── */
function ReviseModal({
  course,
  onClose,
  onSubmitted,
}: {
  course: AdminCourse;
  onClose: () => void;
  onSubmitted: (dbId: number) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!feedback.trim()) {
      setErr("Describe the change you want.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await adminReviseCourse(course.db_id, feedback.trim());
      onSubmitted(course.db_id);
    } catch {
      setErr("Couldn't start the revision.");
      setSending(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>Revise course</h3>
        <p className="modal-sub">{course.title} — resumes the build session and edits in place.</p>
        <div className="field">
          <label>Feedback</label>
          <textarea
            className="textarea"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Make the quiz harder and add a module on troubleshooting."
          />
        </div>
        {err && <p className="admin-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={sending}>
            {sending ? "Starting…" : "Apply feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Preview modal ────────────────────────────────────────────────────── */
function PreviewModal({ detail, onClose }: { detail: AdminCourseDetail; onClose: () => void }) {
  const modules = detail.content?.modules ?? [];
  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal wide">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>{detail.title ?? "Course"}</h3>
        <p className="modal-sub">{detail.description}</p>
        {modules.length === 0 ? (
          <div className="admin-empty">No content available.</div>
        ) : (
          modules.map((m) => (
            <div key={m.id} style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{m.title}</div>
              <ul style={{ paddingLeft: "1.1rem", color: "var(--oa-text-secondary)", fontSize: "0.85rem" }}>
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    {l.title}{" "}
                    <span className="cell-muted">({l.questions.length} questions)</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
