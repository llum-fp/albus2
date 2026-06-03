import { useEffect, useState } from "react";
import {
  adminCreateUser,
  adminDeleteUser,
  adminFetchUsers,
  adminUpdateUser,
  type User,
} from "../api";
import { USER_ROLES } from "./Login";
import { ChevronDown, Pencil, Plus, Trash, X } from "./icons";
import { formatLocalDate as fmtDate } from "../format";

const ROLE_OPTIONS = USER_ROLES.map((r) => r.value); // Admin | Technical | Sales

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);

  const refresh = async () => {
    try {
      setUsers(await adminFetchUsers());
      setError(null);
    } catch {
      setError("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const remove = async (u: User) => {
    if (!confirm(`Delete user ${u.name}?`)) return;
    try {
      await adminDeleteUser(u.id);
      setUsers((cur) => cur.filter((x) => x.id !== u.id));
    } catch {
      setError("Couldn't delete the user.");
    }
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Users</h2>
          <p className="sub">Manage accounts and their access role.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
          <Plus size={15} /> New user
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {loading ? (
        <div className="admin-loading">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">No users yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-title">{u.name}</td>
                  <td className="cell-muted">{u.email}</td>
                  <td>
                    <span className="badge badge-neutral">{u.role}</span>
                  </td>
                  <td className="cell-muted">{fmtDate(u.created_at)}</td>
                  <td className="cell-actions">
                    <button className="icon-btn" title="Edit name / email" onClick={() => setEdit(u)}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={() => remove(u)}>
                      <Trash size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewUserModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            refresh();
          }}
        />
      )}
      {edit && (
        <EditUserModal
          user={edit}
          onClose={() => setEdit(null)}
          onSaved={(updated) => {
            setUsers((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty =
    name.trim() !== user.name || email.trim() !== user.email || role !== user.role;

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const updated = await adminUpdateUser(user.id, {
        name: name.trim(),
        email: email.trim(),
        role,
      });
      onSaved(updated);
    } catch (e) {
      setErr(String(e).includes("409") ? "That email is already registered." : "Couldn't save changes.");
      setSending(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>Edit user</h3>
        <p className="modal-sub">Update the name, email and role.</p>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <div className="select-wrap">
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              {!ROLE_OPTIONS.includes(role as never) && (
                <option value={role} disabled>
                  {role}
                </option>
              )}
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown size={16} className="select-caret" />
          </div>
        </div>
        {err && <p className="admin-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={sending || !dirty}>
            {sending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLE_OPTIONS[1]); // Technical
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await adminCreateUser({ name: name.trim(), email: email.trim(), role });
      onCreated();
    } catch (e) {
      setErr(String(e).includes("409") ? "That email is already registered." : "Couldn't create the user.");
      setSending(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-modal">
        <button className="icon-btn modal-close" onClick={onClose}><X size={16} /></button>
        <h3>New user</h3>
        <p className="modal-sub">Create an account and assign its role.</p>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <div className="select-wrap">
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown size={16} className="select-caret" />
          </div>
        </div>
        {err && <p className="admin-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={sending}>
            {sending ? "Creating…" : "Create user"}
          </button>
        </div>
      </div>
    </div>
  );
}
