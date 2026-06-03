import { useEffect, useState, useMemo } from "react";
import { fetchCourses, fetchUserProgress, fetchPaths, userKey, type CourseSummary, type PathSummary, type SessionUser } from "../api";
import { BookOpen, GraduationCap, ArrowRight, Check, Search, X } from "./icons";
import { formatDuration } from "../format";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { progressPct, type CourseProgress } from "../progress";

type Tab = "catalogo" | "mios" | "paths";
type MineFilter = "all" | "active" | "done";
type SortBy = "title-asc" | "title-desc" | "modules-desc" | "modules-asc";

export default function Home({
  user,
  onOpen,
  onOpenPath,
  onAdmin,
  onLogout,
}: {
  user: SessionUser;
  onOpen: (courseId: string) => void;
  onOpenPath: (pathId: number) => void;
  onAdmin?: () => void;
  onLogout: () => void;
}) {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Tab>("mios");
  const [mineFilter, setMineFilter] = useState<MineFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("title-asc");

  useEffect(() => {
    fetchCourses()
      .then((c) => { setCourses(c); setState("ready"); })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    fetchPaths(user.id).then(setPaths).catch(() => {});
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progreso del usuario: se hidrata desde el backend al montar y se almacena en
  // estado para que Home re-renderice cuando llegan los datos remotos.
  const pkey = userKey(user);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});

  useEffect(() => {
    fetchUserProgress(user.id)
      .then((remote) => {
        const map: Record<string, CourseProgress> = {};
        for (const [courseId, r] of Object.entries(remote)) {
          map[courseId] = {
            furthest: r.furthest,
            total: r.total,
            completed: r.completed,
            updatedAt: new Date(r.updated_at).getTime(),
          };
        }
        setProgress(map);
      })
      .catch(() => {});
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedCourses = useMemo(() => {
    return courses
      .filter((c) =>
        !search ||
        `${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "title-asc") return a.title.localeCompare(b.title);
        if (sortBy === "title-desc") return b.title.localeCompare(a.title);
        if (sortBy === "modules-desc") return b.module_count - a.module_count;
        return a.module_count - b.module_count;
      });
  }, [courses, search, sortBy]);

  const hasActiveFilters = search !== "";

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
          className={`tab ${tab === "mios" ? "active" : ""}`}
          onClick={() => setTab("mios")}
        >
          My courses
          {enrolled.length > 0 && <span className="tab-count">{enrolled.length}</span>}
        </button>
        <button
          className={`tab ${tab === "catalogo" ? "active" : ""}`}
          onClick={() => setTab("catalogo")}
        >
          Course catalog
        </button>
        <button
          className={`tab ${tab === "paths" ? "active" : ""}`}
          onClick={() => setTab("paths")}
        >
          Learning paths
          {paths.length > 0 && <span className="tab-count">{paths.length}</span>}
        </button>
      </nav>

      <main className="home-main">
        {state === "loading" && <p className="muted">Loading courses…</p>}
        {state === "error" && (
          <p className="muted">Couldn't load the courses. Is the backend running on :8001?</p>
        )}

        {state === "ready" && tab === "catalogo" && (
          <>
            <div className="catalog-controls">
              <div className="search-wrap">
                <Search size={15} className="search-icon" />
                <input
                  className="catalog-search"
                  type="text"
                  placeholder="Search courses…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="search-clear" onClick={() => setSearch("")}>
                    <X size={13} />
                  </button>
                )}
              </div>
              <select
                className="catalog-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="title-asc">Title A → Z</option>
                <option value="title-desc">Title Z → A</option>
                <option value="modules-desc">Most modules first</option>
                <option value="modules-asc">Fewest modules first</option>
              </select>
            </div>

            <div className="catalog-meta">
              <span className="catalog-count">
                {hasActiveFilters
                  ? `${displayedCourses.length} of ${courses.length} courses`
                  : `${courses.length} course${courses.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {displayedCourses.length === 0 ? (
              <div className="catalog-empty">
                <p>No courses match your search.</p>
                <button
                  className="chip active"
                  onClick={() => setSearch("")}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="course-grid">
                {displayedCourses.map((c) => (
                  <CourseCard key={c.id} c={c} p={progress[c.id]} onOpen={onOpen} />
                ))}
              </div>
            )}
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

        {tab === "paths" && (
          <>
            <p className="eyebrow section-title">Learning paths</p>
            {paths.length === 0 ? (
              <p className="muted">No learning paths available yet.</p>
            ) : (() => {
              const filtered = paths.filter(
                (p) => !search || `${p.title} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase())
              );
              return filtered.length === 0 ? (
                <div className="empty-search">
                  <p>No paths match your search.</p>
                  <button className="link-btn" onClick={() => setSearch("")}>Clear filters</button>
                </div>
              ) : (
                <div className="course-grid">
                  {filtered.map((p) => (
                    <PathCard key={p.id} p={p} onOpen={onOpenPath} />
                  ))}
                </div>
              );
            })()}
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
        {p && (p.completed ? (
          <span className="badge badge-done">
            <Check size={11} /> Completed
          </span>
        ) : (
          <span className="badge badge-progress">In progress</span>
        ))}
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
          {formatDuration(c.duration_min) && ` · ${formatDuration(c.duration_min)}`}
        </span>
        <span className="course-open">
          {cta} <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}

/* Tarjeta de learning path. */
function PathCard({ p, onOpen }: { p: PathSummary; onOpen: (id: number) => void }) {
  const pct = p.course_count > 0 ? Math.round((p.completed_count / p.course_count) * 100) : 0;
  const started = p.completed_count > 0 && p.completed_count < p.course_count;
  const completed = p.completed_count === p.course_count && p.course_count > 0;
  const cta = completed ? "Review" : started ? "Continue" : "Start";

  return (
    <button className="course-card" onClick={() => onOpen(p.id)}>
      <div className="course-card-top">
        <span className="course-icon">
          <GraduationCap size={20} />
        </span>
        {completed ? (
          <span className="badge badge-done"><Check size={11} /> Completed</span>
        ) : started ? (
          <span className="badge badge-progress">In progress</span>
        ) : (
          <span className="badge badge-live">Path</span>
        )}
      </div>
      <div className="course-title">{p.title}</div>
      {p.description && <div className="course-desc">{p.description}</div>}

      {started && (
        <div className="course-progress">
          <div className="course-progress-track">
            <div className="course-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="course-progress-pct">{pct}%</span>
        </div>
      )}

      <div className="course-footer">
        <span className="muted-sm">
          {p.course_count} course{p.course_count !== 1 ? "s" : ""}
          {p.course_count > 0 && ` · ${p.completed_count} completed`}
          {formatDuration(p.total_duration_min) && ` · ${formatDuration(p.total_duration_min)}`}
        </span>
        <span className="course-open">
          {cta} <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}
