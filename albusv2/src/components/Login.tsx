import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown } from "./icons";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";
import { fetchUsers, type SessionUser } from "../api";

/* Roles de acceso a la plataforma (catálogo, usado también por el panel de
   admin para asignar rol). El login YA NO elige un rol genérico: elige un
   usuario real existente (ver abajo). */
export type UserRole = "Admin" | "Technical" | "Sales";

export const USER_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "Admin", label: "Admin", desc: "Full access to the platform" },
  { value: "Technical", label: "Technical", desc: "Technical team training" },
  { value: "Sales", label: "Sales", desc: "Sales team training" },
];

export default function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<number | "">("");

  useEffect(() => {
    fetchUsers()
      .then((u) => {
        setUsers(u);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const current = users.find((u) => u.id === selectedId);

  const submit = () => {
    if (current) onLogin(current);
  };

  return (
    <div className="login">
      <div className="login-topbar">
        <ThemeToggle />
      </div>

      <main className="login-main">
        <div className="login-card">
          <span className="brand-mark login-mark">
            <AlbusIcon size={28} />
          </span>
          <h1 className="login-title">Albus</h1>
          <p className="eyebrow">OmniAccess · Training Platform</p>

          <label className="login-label" htmlFor="user-select">
            Select a user
          </label>
          <div className="select-wrap">
            <select
              id="user-select"
              className="select"
              value={selectedId}
              disabled={state !== "ready" || users.length === 0}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            >
              <option value="" disabled>
                {state === "loading"
                  ? "Loading users…"
                  : state === "error"
                  ? "Couldn't load users"
                  : users.length === 0
                  ? "No users yet"
                  : "— Choose a user —"}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="select-caret" />
          </div>
          {current && <p className="login-hint">Signing in as {current.name} ({current.role})</p>}
          {state === "error" && (
            <p className="login-hint">Is the backend running on :8001?</p>
          )}
          {state === "ready" && users.length === 0 && (
            <p className="login-hint">Ask an admin to create a user first.</p>
          )}

          <button
            className="btn btn-primary login-submit"
            onClick={submit}
            disabled={!current}
          >
            Sign in <ArrowRight size={16} />
          </button>
        </div>
      </main>

      <footer className="home-footer">
        OmniAccess Albus — Training Platform
      </footer>
    </div>
  );
}
