import { useEffect, useMemo, useState } from "react";
import { fetchCourses, type CourseSummary } from "../api";
import { BookOpen, ArrowRight, Check } from "./icons";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import type { UserRole } from "./Login";
import { getProgressMap, progressPct, type CourseProgress } from "../progress";

type Tab = "catalogo" | "mios";
type MineFilter = "all" | "active" | "done";

export default function Home({
  user,
  onOpen,
  onAdmin,
  onLogout,
}: {
  user: UserRole;
  onOpen: (courseId: string) => void;
  onAdmin?: () => void;
  onLogout: () => void;
}) {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Tab>("catalogo");
  const [mineFilter, setMineFilter] = useState<MineFilter>("all");

  useEffect(() => {
    fetchCourses()
      .then((c) => {
        setCourses(c);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  // Progreso del usuario (localStorage). Se lee en cada montaje del Home, así que
  // al volver de un curso refleja el último avance.
  const progress = useMemo(() => getProgressMap(user), [user]);

  const enrolled = courses.filter((c) => progress[c.id]);
  const mine = enrolled.filter((c) => {
    const p = progress[c.id];
    if (mineFilter === "active") return !p.completed;
    if (mineFilter === "done") return p.completed;
    return true;
  });
  const activeCount = enrolled.filter((c) => !progress[c.id].completed).length;
  const doneCount = enrolled.filter((c) => progress[c.id].completed).length;

  return (
    <div className="home">
      <header className="home-header">
        <div className="brand">
          <span className="brand-mark">
            <AlbusIcon size={24} />
          </span>
          <div>
            <h1>Albus</h1>
            <span className="eyebrow">OmniAccess · Training Platform</span>
          </div>
        </div>
        <div className="home-header-right">
          <ThemeToggle />
          <UserMenu user={user} onAccount={() => {}} onAdmin={onAdmin} onLogout={onLogout} />
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === "catalogo" ? "active" : ""}`}
          onClick={() => setTab("catalogo")}
        >
          Course catalog
        </button>
        <button
          className={`tab ${tab === "mios" ? "active" : ""}`}
          onClick={() => setTab("mios")}
        >
          My courses
          {enrolled.length > 0 && <span className="tab-count">{enrolled.length}</span>}
        </button>
      </nav>

      <main className="home-main">
        {state === "loading" && <p className="muted">Loading courses…</p>}
        {state === "error" && (
          <p className="muted">Couldn't load the courses. Is the backend running on :8001?</p>
        )}

        {state === "ready" && tab === "catalogo" && (
          <>
            <p className="eyebrow section-title">All courses</p>
            <div className="course-grid">
              {courses.map((c) => (
                <CourseCard key={c.id} c={c} p={progress[c.id]} onOpen={onOpen} />
              ))}
              {courses.length === 0 && <p className="muted">No courses published yet.</p>}
            </div>
          </>
        )}

        {state === "ready" && tab === "mios" && (
          <>
            <div className="filter-row">
              <p className="eyebrow section-title" style={{ margin: 0 }}>
                My courses
              </p>
              <div className="filter-chips">
                <button
                  className={`chip ${mineFilter === "all" ? "active" : ""}`}
                  onClick={() => setMineFilter("all")}
                >
                  All <span className="chip-count">{enrolled.length}</span>
                </button>
                <button
                  className={`chip ${mineFilter === "active" ? "active" : ""}`}
                  onClick={() => setMineFilter("active")}
                >
                  In progress <span className="chip-count">{activeCount}</span>
                </button>
                <button
                  className={`chip ${mineFilter === "done" ? "active" : ""}`}
                  onClick={() => setMineFilter("done")}
                >
                  Completed <span className="chip-count">{doneCount}</span>
                </button>
              </div>
            </div>

            {enrolled.length === 0 ? (
              <p className="muted">
                You haven't started any course yet. Go to the catalog and open one to see it here.
              </p>
            ) : mine.length === 0 ? (
              <p className="muted">You have no courses in this category.</p>
            ) : (
              <div className="course-grid">
                {mine.map((c) => (
                  <CourseCard key={c.id} c={c} p={progress[c.id]} onOpen={onOpen} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="home-footer">OmniAccess Albus — Training Platform</footer>
    </div>
  );
}

/* Tarjeta de curso con estado y barra de progreso si está en marcha/acabado. */
function CourseCard({
  c,
  p,
  onOpen,
}: {
  c: CourseSummary;
  p: CourseProgress | undefined;
  onOpen: (id: string) => void;
}) {
  const pct = progressPct(p);
  const cta = !p ? "Start" : p.completed ? "Review" : "Continue";

  return (
    <button className="course-card" onClick={() => onOpen(c.id)}>
      <div className="course-card-top">
        <span className="course-icon">
          <BookOpen size={20} />
        </span>
        {!p ? (
          <span className="badge badge-live">Active</span>
        ) : p.completed ? (
          <span className="badge badge-done">
            <Check size={11} /> Completed
          </span>
        ) : (
          <span className="badge badge-progress">In progress</span>
        )}
      </div>
      <div className="course-title">{c.title}</div>
      <div className="course-desc">{c.description}</div>

      {p && (
        <div className="course-progress">
          <div className="course-progress-track">
            <div className="course-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="course-progress-pct">{pct}%</span>
        </div>
      )}

      <div className="course-footer">
        <span className="muted-sm">
          {c.module_count} modules · {c.lesson_count} lessons
        </span>
        <span className="course-open">
          {cta} <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}
