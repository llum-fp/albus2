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
type StatusFilter = "all" | "not-started" | "in-progress" | "completed";
type DurationFilter = "all" | "short" | "medium" | "long";
type SizeFilter = "all" | "small" | "medium" | "large";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [profileFilter, setProfileFilter] = useState<string>("all");

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
      .filter((c) => {
        if (search && !`${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase())) return false;
        const p = progress[c.id];
        if (statusFilter === "not-started" && p) return false;
        if (statusFilter === "in-progress" && (!p || p.completed)) return false;
        if (statusFilter === "completed" && (!p || !p.completed)) return false;
        if (durationFilter === "short" && (c.duration_min == null || c.duration_min > 30)) return false;
        if (durationFilter === "medium" && (c.duration_min == null || c.duration_min <= 30 || c.duration_min > 60)) return false;
        if (durationFilter === "long" && (c.duration_min == null || c.duration_min <= 60)) return false;
        if (sizeFilter === "small" && c.module_count > 2) return false;
        if (sizeFilter === "medium" && (c.module_count < 3 || c.module_count > 5)) return false;
        if (sizeFilter === "large" && c.module_count < 6) return false;
        if (profileFilter !== "all" && c.profile !== profileFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title-asc") return a.title.localeCompare(b.title);
        if (sortBy === "title-desc") return b.title.localeCompare(a.title);
        if (sortBy === "modules-desc") return b.module_count - a.module_count;
        return a.module_count - b.module_count;
      });
  }, [courses, search, sortBy, statusFilter, durationFilter, sizeFilter, profileFilter, progress]);

  const hasActiveFilters = search !== "" || statusFilter !== "all" || durationFilter !== "all" || sizeFilter !== "all" || profileFilter !== "all";

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setDurationFilter("all");
    setSizeFilter("all");
    setProfileFilter("all");
  }

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

            <div className="catalog-layout">
              <CatalogFilters
                courses={courses}
                progress={progress}
                search={search}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                durationFilter={durationFilter}
                setDurationFilter={setDurationFilter}
                sizeFilter={sizeFilter}
                setSizeFilter={setSizeFilter}
                profileFilter={profileFilter}
                setProfileFilter={setProfileFilter}
                isAdmin={user.role === "Admin"}
                hasActiveFilters={hasActiveFilters}
                onClearAll={clearAllFilters}
              />

              <div>
                <div className="catalog-meta">
                  <span className="catalog-count">
                    {hasActiveFilters
                      ? `${displayedCourses.length} of ${courses.length} courses`
                      : `${courses.length} course${courses.length !== 1 ? "s" : ""}`}
                  </span>
                </div>

                {displayedCourses.length === 0 ? (
                  <div className="catalog-empty">
                    <p>No courses match your filters.</p>
                    <button className="chip active" onClick={clearAllFilters}>
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
              </div>
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

function CatalogFilters({
  courses,
  progress,
  search,
  statusFilter,
  setStatusFilter,
  durationFilter,
  setDurationFilter,
  sizeFilter,
  setSizeFilter,
  profileFilter,
  setProfileFilter,
  isAdmin,
  hasActiveFilters,
  onClearAll,
}: {
  courses: CourseSummary[];
  progress: Record<string, CourseProgress>;
  search: string;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  durationFilter: DurationFilter;
  setDurationFilter: (f: DurationFilter) => void;
  sizeFilter: SizeFilter;
  setSizeFilter: (f: SizeFilter) => void;
  profileFilter: string;
  setProfileFilter: (f: string) => void;
  isAdmin: boolean;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}) {
  const profiles = isAdmin
    ? ([...new Set(courses.map((c) => c.profile).filter(Boolean))] as string[]).sort()
    : [];

  function countWhere(
    st: StatusFilter = "all",
    dur: DurationFilter = "all",
    sz: SizeFilter = "all",
    prof: string = "all"
  ): number {
    return courses.filter((c) => {
      const p = progress[c.id];
      if (search && !`${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (st === "not-started" && p) return false;
      if (st === "in-progress" && (!p || p.completed)) return false;
      if (st === "completed" && (!p || !p.completed)) return false;
      if (dur === "short" && (c.duration_min == null || c.duration_min > 30)) return false;
      if (dur === "medium" && (c.duration_min == null || c.duration_min <= 30 || c.duration_min > 60)) return false;
      if (dur === "long" && (c.duration_min == null || c.duration_min <= 60)) return false;
      if (sz === "small" && c.module_count > 2) return false;
      if (sz === "medium" && (c.module_count < 3 || c.module_count > 5)) return false;
      if (sz === "large" && c.module_count < 6) return false;
      if (prof !== "all" && c.profile !== prof) return false;
      return true;
    }).length;
  }

  const statusCounts: Record<StatusFilter, number> = {
    all: countWhere("all", durationFilter, sizeFilter, profileFilter),
    "not-started": countWhere("not-started", durationFilter, sizeFilter, profileFilter),
    "in-progress": countWhere("in-progress", durationFilter, sizeFilter, profileFilter),
    completed: countWhere("completed", durationFilter, sizeFilter, profileFilter),
  };
  const durationCounts: Record<DurationFilter, number> = {
    all: countWhere(statusFilter, "all", sizeFilter, profileFilter),
    short: countWhere(statusFilter, "short", sizeFilter, profileFilter),
    medium: countWhere(statusFilter, "medium", sizeFilter, profileFilter),
    long: countWhere(statusFilter, "long", sizeFilter, profileFilter),
  };
  const sizeCounts: Record<SizeFilter, number> = {
    all: countWhere(statusFilter, durationFilter, "all", profileFilter),
    small: countWhere(statusFilter, durationFilter, "small", profileFilter),
    medium: countWhere(statusFilter, durationFilter, "medium", profileFilter),
    large: countWhere(statusFilter, durationFilter, "large", profileFilter),
  };

  const profileCounts: Record<string, number> = { all: countWhere(statusFilter, durationFilter, sizeFilter, "all") };
  for (const p of profiles) profileCounts[p] = countWhere(statusFilter, durationFilter, sizeFilter, p);

  function FilterOption<T extends string>({
    value,
    current,
    label,
    count,
    onChange,
  }: {
    value: T;
    current: T;
    label: string;
    count: number;
    onChange: (v: T) => void;
  }) {
    return (
      <button
        className={`filter-option ${current === value ? "active" : ""}`}
        onClick={() => onChange(current === value ? "all" as unknown as T : value)}
      >
        <span>{label}</span>
        <span className="filter-option-count">{count}</span>
      </button>
    );
  }

  return (
    <div className="catalog-filters">
      <div className="filter-panel-head">
        <span className="filter-panel-title">Filters</span>
        {hasActiveFilters && (
          <button className="filter-clear-all" onClick={onClearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className="filter-section">
        <div className="filter-section-title">Status</div>
        <FilterOption value="all" current={statusFilter} label="All" count={statusCounts.all} onChange={setStatusFilter} />
        <FilterOption value="not-started" current={statusFilter} label="Not started" count={statusCounts["not-started"]} onChange={setStatusFilter} />
        <FilterOption value="in-progress" current={statusFilter} label="In progress" count={statusCounts["in-progress"]} onChange={setStatusFilter} />
        <FilterOption value="completed" current={statusFilter} label="Completed" count={statusCounts.completed} onChange={setStatusFilter} />
      </div>

      <div className="filter-section">
        <div className="filter-section-title">Duration</div>
        <FilterOption value="all" current={durationFilter} label="All" count={durationCounts.all} onChange={setDurationFilter} />
        <FilterOption value="short" current={durationFilter} label="≤ 30 min" count={durationCounts.short} onChange={setDurationFilter} />
        <FilterOption value="medium" current={durationFilter} label="30 – 60 min" count={durationCounts.medium} onChange={setDurationFilter} />
        <FilterOption value="long" current={durationFilter} label="> 1 hour" count={durationCounts.long} onChange={setDurationFilter} />
      </div>

      <div className="filter-section">
        <div className="filter-section-title">Size</div>
        <FilterOption value="all" current={sizeFilter} label="All" count={sizeCounts.all} onChange={setSizeFilter} />
        <FilterOption value="small" current={sizeFilter} label="1–2 modules" count={sizeCounts.small} onChange={setSizeFilter} />
        <FilterOption value="medium" current={sizeFilter} label="3–5 modules" count={sizeCounts.medium} onChange={setSizeFilter} />
        <FilterOption value="large" current={sizeFilter} label="6+ modules" count={sizeCounts.large} onChange={setSizeFilter} />
      </div>

      {isAdmin && profiles.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-title">Department</div>
          <button
            className={`filter-option ${profileFilter === "all" ? "active" : ""}`}
            onClick={() => setProfileFilter("all")}
          >
            <span>All</span>
            <span className="filter-option-count">{profileCounts.all}</span>
          </button>
          {profiles.map((p) => (
            <button
              key={p}
              className={`filter-option ${profileFilter === p ? "active" : ""}`}
              onClick={() => setProfileFilter(profileFilter === p ? "all" : p)}
            >
              <span style={{ textTransform: "capitalize" }}>{p}</span>
              <span className="filter-option-count">{profileCounts[p]}</span>
            </button>
          ))}
        </div>
      )}
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
