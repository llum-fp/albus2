import { useEffect, useState } from "react";
import {
  adminFetchPaths, adminCreatePath, adminUpdatePath,
  adminPublishPath, adminUnpublishPath, adminSetPathCourses, adminDeletePath,
  adminFetchCourses,
  type AdminPath, type AdminCourse, type PathCourse,
} from "../api";
import { Plus, Pencil, Trash, X, Check, ChevronDown, ChevronRight } from "./icons";

type Modal =
  | { kind: "create" }
  | { kind: "edit"; path: AdminPath }
  | { kind: "courses"; path: AdminPath }
  | null;

export default function AdminPaths() {
  const [paths, setPaths] = useState<AdminPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);

  const reload = () =>
    adminFetchPaths()
      .then(setPaths)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const togglePublish = async (p: AdminPath) => {
    const updated = p.published ? await adminUnpublishPath(p.id) : await adminPublishPath(p.id);
    setPaths((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
  };

  const remove = async (p: AdminPath) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await adminDeletePath(p.id);
    setPaths((cur) => cur.filter((x) => x.id !== p.id));
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Learning Paths</h2>
          <p className="sub">Group courses into ordered learning journeys.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ kind: "create" })}>
          <Plus size={15} /> New path
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : paths.length === 0 ? (
        <div className="admin-empty">No learning paths yet. Create one to get started.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Audience</th>
              <th>Courses</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => (
              <tr key={p.id}>
                <td className="cell-title">{p.title}</td>
                <td className="cell-muted">{p.profile ? capitalize(p.profile) : "All"}</td>
                <td className="cell-muted">{p.course_count}</td>
                <td>
                  <span className={`badge ${p.published ? "badge-live" : "badge-draft"}`}>
                    {p.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="cell-actions">
                  <button className="icon-btn" title="Edit details" onClick={() => setModal({ kind: "edit", path: p })}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn" title="Manage courses" onClick={() => setModal({ kind: "courses", path: p })}>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title={p.published ? "Unpublish" : "Publish"}
                    onClick={() => togglePublish(p)}
                  >
                    {p.published ? <X size={15} /> : <Check size={15} />}
                  </button>
                  <button className="icon-btn icon-btn-danger" title="Delete" onClick={() => remove(p)}>
                    <Trash size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === "create" && (
        <PathFormModal
          onClose={() => setModal(null)}
          onSaved={(p) => { setPaths((c) => [p, ...c]); setModal(null); }}
        />
      )}
      {modal?.kind === "edit" && (
        <PathFormModal
          path={modal.path}
          onClose={() => setModal(null)}
          onSaved={(p) => { setPaths((c) => c.map((x) => (x.id === p.id ? p : x))); setModal(null); }}
        />
      )}
      {modal?.kind === "courses" && (
        <ManageCoursesModal
          path={modal.path}
          onClose={() => { setModal(null); reload(); }}
        />
      )}
    </>
  );
}

/* ── Create / Edit path modal ─────────────────────────────────────────────── */
function PathFormModal({
  path,
  onClose,
  onSaved,
}: {
  path?: AdminPath;
  onClose: () => void;
  onSaved: (p: AdminPath) => void;
}) {
  const [title, setTitle] = useState(path?.title ?? "");
  const [description, setDescription] = useState(path?.description ?? "");
  const [profile, setProfile] = useState(path?.profile ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true);
    setErr(null);
    try {
      const body = { title: title.trim(), description, profile: profile || null };
      const result = path
        ? await adminUpdatePath(path.id, body)
        : await adminCreatePath(body);
      onSaved(result);
    } catch {
      setErr("Couldn't save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>{path ? "Edit path" : "New learning path"}</h3>
        <div className="field">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Audience</label>
          <div className="select-wrap">
            <select className="select" value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="">All roles</option>
              <option value="technical">Technical</option>
              <option value="sales">Sales</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
        </div>
        {err && <p className="field-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Manage courses in path modal ─────────────────────────────────────────── */
function ManageCoursesModal({ path, onClose }: { path: AdminPath; onClose: () => void }) {
  const [courses, setCourses] = useState<PathCourse[]>(
    [...path.courses].sort((a, b) => a.position - b.position)
  );
  const [allCourses, setAllCourses] = useState<AdminCourse[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetchCourses().then((c) => setAllCourses(c.filter((x) => x.published))).catch(() => {});
  }, []);

  const addCourse = (sessionId: string) => {
    if (courses.find((c) => c.course_session_id === sessionId)) return;
    setCourses((c) => [...c, { course_session_id: sessionId, position: c.length + 1 }]);
  };

  const remove = (sessionId: string) => {
    setCourses((c) =>
      c
        .filter((x) => x.course_session_id !== sessionId)
        .map((x, i) => ({ ...x, position: i + 1 }))
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...courses];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setCourses(next.map((c, i) => ({ ...c, position: i + 1 })));
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminSetPathCourses(path.id, courses);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const usedIds = new Set(courses.map((c) => c.course_session_id));
  const available = allCourses.filter((c) => c.session_id && !usedIds.has(c.session_id));

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal admin-modal-wide">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>Manage courses — {path.title}</h3>
        <p className="modal-sub">Set the order learners will follow.</p>

        {courses.length === 0 ? (
          <p className="muted">No courses yet. Add one below.</p>
        ) : (
          <div className="path-course-list">
            {courses.map((c, i) => {
              const meta = allCourses.find((x) => x.session_id === c.course_session_id);
              return (
                <div key={c.course_session_id} className="path-course-row">
                  <span className="path-course-pos">{c.position}</span>
                  <span className="path-course-title">{meta?.title ?? c.course_session_id}</span>
                  <div className="path-course-actions">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">▲</button>
                    <button className="icon-btn" disabled={i === courses.length - 1} onClick={() => move(i, 1)} title="Move down">▼</button>
                    <button className="icon-btn icon-btn-danger" onClick={() => remove(c.course_session_id)} title="Remove"><X size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {available.length > 0 && (
          <div className="field" style={{ marginTop: "1rem" }}>
            <label>Add a course</label>
            <div className="select-wrap">
              <select
                className="select"
                value=""
                onChange={(e) => { if (e.target.value) addCourse(e.target.value); }}
              >
                <option value="">— select a published course —</option>
                {available.map((c) => (
                  <option key={c.session_id} value={c.session_id ?? ""}>
                    {c.title ?? c.session_id}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
