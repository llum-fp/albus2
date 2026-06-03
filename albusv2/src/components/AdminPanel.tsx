import { useState } from "react";
import "../admin.css";
import { ArrowLeft, BarChart, BookOpen, GraduationCap, Settings, Users } from "./icons";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";
import AdminCourses from "./AdminCourses";
import AdminUsers from "./AdminUsers";
import AdminSurveys from "./AdminSurveys";
import AdminPaths from "./AdminPaths";

type Section = "courses" | "paths" | "users" | "surveys" | "settings";

const NAV: { id: Section; label: string; Icon: typeof BookOpen }[] = [
  { id: "courses", label: "Courses", Icon: BookOpen },
  { id: "paths", label: "Learning Paths", Icon: GraduationCap },
  { id: "users", label: "Users", Icon: Users },
  { id: "surveys", label: "Surveys", Icon: BarChart },
  { id: "settings", label: "Settings", Icon: Settings },
];

/* Admin console — left-nav shell. Section state is local (no router), matching
   the rest of the app's state-based routing. */
export default function AdminPanel({
  onBack,
  onOpenCourse,
}: {
  onBack: () => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const [section, setSection] = useState<Section>("courses");

  return (
    <div className="admin">
      <nav className="admin-nav">
        <div className="brand">
          <span className="brand-mark">
            <AlbusIcon size={22} />
          </span>
          <div>
            <h1>Admin</h1>
            <span className="eyebrow">OmniAccess · Albus</span>
          </div>
        </div>

        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`admin-nav-item ${section === id ? "active" : ""}`}
            onClick={() => setSection(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}

        <div className="admin-nav-spacer" />
        <div style={{ padding: "0 0.5rem 0.5rem" }}>
          <ThemeToggle />
        </div>
        <button className="admin-nav-item" onClick={onBack}>
          <ArrowLeft size={18} />
          Back to catalog
        </button>
      </nav>

      <div className="admin-content">
        {section === "courses" && <AdminCourses onOpenCourse={onOpenCourse} />}
        {section === "paths" && <AdminPaths />}
        {section === "users" && <AdminUsers />}
        {section === "surveys" && <AdminSurveys />}
        {section === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}

function AdminSettings() {
  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Settings</h2>
          <p className="sub">Platform configuration.</p>
        </div>
      </div>
      <div className="admin-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <img
          src="https://c.tenor.com/KHkxIgIlHAgAAAAC/magic-spongebob.gif"
          alt="Nothing to see here"
          style={{ width: 200, borderRadius: "0.75rem" }}
        />
        <span>No settings yet. Check back later.</span>
      </div>
    </>
  );
}
