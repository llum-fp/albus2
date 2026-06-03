import { ArrowLeft, Shield } from "./icons";
import ThemeToggle from "./ThemeToggle";

/* Panel de administración (placeholder). De momento solo muestra la estructura;
   las secciones se irán implementando. */
export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const sections = [
    { title: "Courses", desc: "Create, edit and publish catalog courses." },
    { title: "Users", desc: "Manage profiles and access permissions." },
    { title: "Progress", desc: "View learners' progress per course." },
    { title: "Settings", desc: "General platform configuration." },
  ];

  return (
    <div className="home">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark">
            <Shield size={22} />
          </span>
          <div>
            <h1>Admin panel</h1>
            <span className="eyebrow">OmniAccess · Albus</span>
          </div>
        </div>
        <div className="home-header-right">
          <ThemeToggle />
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </header>

      <main className="home-main">
        <p className="eyebrow section-title">Administration</p>
        <div className="admin-banner">
          🚧 This section is under construction. For now it's a placeholder.
        </div>
        <div className="course-grid">
          {sections.map((s) => (
            <div key={s.title} className="course-card admin-card">
              <div className="course-title">{s.title}</div>
              <div className="course-desc">{s.desc}</div>
              <div className="course-footer">
                <span className="badge badge-soon">Coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="home-footer">OmniAccess Albus — Training Platform</footer>
    </div>
  );
}
