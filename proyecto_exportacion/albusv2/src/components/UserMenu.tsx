import { useEffect, useRef, useState } from "react";
import { LogOut, CircleDot, Shield } from "./icons";
import type { UserRole } from "./Login";

/* Avatar circular con la inicial del usuario. Al pulsarlo despliega un menú con
   "Tu cuenta", "Cerrar sesión" y, para admins, acceso al panel de administración.
   Se cierra al hacer clic fuera o con Escape. */
export default function UserMenu({
  user,
  onAccount,
  onAdmin,
  onLogout,
}: {
  user: UserRole;
  onAccount: () => void;
  onAdmin?: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = user.charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-avatar"
        onClick={() => setOpen((v) => !v)}
        title={user}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <span className="user-avatar sm">{initial}</span>
            <div>
              <div className="user-dropdown-name">{user}</div>
              <div className="user-dropdown-role">Active session</div>
            </div>
          </div>
          <div className="user-dropdown-sep" />
          <button
            className="user-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAccount();
            }}
          >
            <CircleDot size={16} /> Your account
          </button>
          {onAdmin && (
            <button
              className="user-dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAdmin();
              }}
            >
              <Shield size={16} /> Admin panel
            </button>
          )}
          <button
            className="user-dropdown-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
