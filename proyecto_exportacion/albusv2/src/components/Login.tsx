import { useState } from "react";
import { ArrowRight, ChevronDown } from "./icons";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";

/* Perfiles de acceso a la plataforma. */
export type UserRole = "Admin" | "Technical" | "Sales";

export const USER_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "Admin", label: "Admin", desc: "Full access to the platform" },
  { value: "Technical", label: "Technical", desc: "Technical team training" },
  { value: "Sales", label: "Sales", desc: "Sales team training" },
];

export default function Login({ onLogin }: { onLogin: (role: UserRole) => void }) {
  const [role, setRole] = useState<UserRole | "">("");

  const submit = () => {
    if (role) onLogin(role);
  };

  const current = USER_ROLES.find((r) => r.value === role);

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
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            >
              <option value="" disabled>
                — Choose a profile —
              </option>
              {USER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="select-caret" />
          </div>
          {current && <p className="login-hint">{current.desc}</p>}

          <button
            className="btn btn-primary login-submit"
            onClick={submit}
            disabled={!role}
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
