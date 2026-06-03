import { useCallback, useEffect, useState } from "react";
import {
  adminCreateProfile,
  fetchProfiles,
  type AgentStatus,
  type Profile,
} from "../api";
import { Check, Plus, RefreshCw, X } from "./icons";

/* Profiles = departments / learner roles. Creating one adds a roles row (so it
   can be assigned to users and filtered in the catalog) and asks agents_back to
   author a <slug>-course-creator agent. The agent build runs in the background
   (minutes), so creation returns instantly and the row shows a live status that
   we poll until it's Ready or Failed. Builds for the new profile fall back to the
   technical agent until its file exists. */

function AgentBadge({ status }: { status: AgentStatus }) {
  if (status === "ready")
    return <span className="badge badge-completed"><Check size={12} /> Agent ready</span>;
  if (status === "pending")
    return <span className="badge badge-pending"><span className="spin"><RefreshCw size={12} /></span> Generating…</span>;
  if (status === "failed")
    return <span className="badge badge-failed">Agent failed</span>;
  return <span className="badge badge-neutral">No agent</span>;
}

export default function AdminProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalName, setModalName] = useState<string | null>(null); // open modal; "" = blank, name = retry

  const refresh = useCallback(async () => {
    try {
      setProfiles(await fetchProfiles());
      setError(null);
    } catch {
      setError("Couldn't load profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while any agent is still generating, so the badge flips to Ready/Failed
  // without a manual refresh.
  useEffect(() => {
    if (!profiles.some((p) => p.agent_status === "pending")) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [profiles, refresh]);

  const building = profiles.some((p) => p.agent_status === "pending");

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Profiles</h2>
          <p className="sub">
            Departments learners belong to. Creating one adds the role and generates a
            tailored course-creator agent in the background.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalName("")}>
          <Plus size={15} /> New profile
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {building && (
        <p className="search-hint">
          <span className="spin" style={{ display: "inline-flex", verticalAlign: "middle" }}>
            <RefreshCw size={13} />
          </span>{" "}
          Generating a course-creator agent… this can take a couple of minutes. You can keep working.
        </p>
      )}

      {loading ? (
        <div className="admin-loading">Loading profiles…</div>
      ) : profiles.length === 0 ? (
        <div className="admin-empty">No profiles yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug (course department)</th>
                <th>Agent</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="cell-title">{p.name}</td>
                  <td className="cell-muted"><code>{p.slug}</code></td>
                  <td><AgentBadge status={p.agent_status} /></td>
                  <td className="cell-actions">
                    {(p.agent_status === "failed" || p.agent_status === "none") && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalName(p.name)}>
                        <RefreshCw size={13} /> {p.agent_status === "failed" ? "Retry" : "Generate agent"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalName !== null && (
        <NewProfileModal
          initialName={modalName}
          onClose={() => setModalName(null)}
          onStarted={() => {
            setModalName(null);
            refresh(); // the new/updated row shows "Generating…"; polling takes over
          }}
        />
      )}
    </>
  );
}

function NewProfileModal({
  initialName,
  onClose,
  onStarted,
}: {
  initialName: string;
  onClose: () => void;
  onStarted: () => void;
}) {
  const retry = initialName !== "";
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    if (!description.trim()) {
      setErr("Describe the audience so the agent can be tailored.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      // Returns immediately (202); the agent build runs in the background.
      await adminCreateProfile({ name: name.trim(), description: description.trim() });
      onStarted();
    } catch (e) {
      setErr(String(e).includes("409") ? "That profile already exists." : "Couldn't start the profile.");
      setSending(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>{retry ? `Generate agent for "${initialName}"` : "New profile"}</h3>
        <p className="modal-sub">
          Add a department/role and generate a course-creator agent tailored to its audience.
          The agent builds in the background (a couple of minutes) — you can close this and keep
          working; the Profiles list shows the status.
        </p>
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing"
            disabled={retry}
          />
        </div>
        <div className="field">
          <label>Audience description</label>
          <textarea
            className="textarea"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who is this for, what should courses emphasize, and what tone/depth? e.g. Product marketing & content staff. Emphasize positioning, personas, messaging pillars and campaign talking points; light on technical mechanics."
          />
        </div>
        {err && <p className="admin-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={sending}>
            {sending ? "Starting…" : retry ? "Generate agent" : "Create profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
