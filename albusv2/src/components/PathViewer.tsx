import { useEffect, useState } from "react";
import { fetchPath, type PathDetail, type PathCourseSummary, type SessionUser } from "../api";
import { ArrowLeft, ArrowRight, Check, BookOpen, CircleDot } from "./icons";
import AlbusIcon from "./AlbusIcon";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function PathViewer({
  pathId,
  user,
  onBack,
  onOpenCourse,
}: {
  pathId: number;
  user: SessionUser;
  onBack: () => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const [path, setPath] = useState<PathDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setState("loading");
    fetchPath(pathId, user.id)
      .then((p) => { setPath(p); setState("ready"); })
      .catch(() => setState("error"));
  }, [pathId, user.id]);

  if (state !== "ready" || !path) {
    return (
      <div className="viewer-fallback">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <p className="muted">
          {state === "loading" ? "Loading path…" : "Couldn't load the learning path."}
        </p>
      </div>
    );
  }

  const pct = path.course_count > 0
    ? Math.round((path.completed_count / path.course_count) * 100)
    : 0;
  const nextCourse = path.courses.find((c) => !c.progress?.completed);

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
          <UserMenu user={user} onAccount={() => {}} onLogout={onBack} />
        </div>
      </header>

      <main className="home-main">
        <button className="btn btn-secondary" style={{ marginBottom: "1.5rem" }} onClick={onBack}>
          <ArrowLeft size={15} /> Back to catalog
        </button>

        <div className="path-hero">
          <div>
            <p className="eyebrow">Learning Path</p>
            <h2 className="path-hero-title">{path.title}</h2>
            {path.description && <p className="path-hero-desc">{path.description}</p>}
          </div>
          <div className="path-hero-stats">
            <span className="muted-sm">{path.course_count} course{path.course_count !== 1 ? "s" : ""}</span>
            <span className="muted-sm">·</span>
            <span className="muted-sm">{path.completed_count} completed</span>
            {path.course_count > 0 && (
              <>
                <div className="course-progress-track" style={{ width: 120 }}>
                  <div className="course-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="muted-sm">{pct}%</span>
              </>
            )}
          </div>
          {nextCourse && (
            <button className="btn btn-primary" onClick={() => onOpenCourse(nextCourse.id)}>
              {path.completed_count === 0 ? "Start path" : "Continue"} <ArrowRight size={15} />
            </button>
          )}
        </div>

        <div className="path-course-list-view">
          {path.courses.map((c, i) => (
            <PathCourseRow
              key={c.id}
              c={c}
              index={i}
              total={path.courses.length}
              onOpen={() => onOpenCourse(c.id)}
            />
          ))}
        </div>
      </main>

      <footer className="home-footer">OmniAccess Albus — Training Platform</footer>
    </div>
  );
}

function PathCourseRow({
  c,
  index,
  total,
  onOpen,
}: {
  c: PathCourseSummary;
  index: number;
  total: number;
  onOpen: () => void;
}) {
  const completed = c.progress?.completed ?? false;
  const started = c.progress && !completed;
  const pct = c.progress
    ? completed ? 100 : Math.round(((c.progress.furthest + 1) / Math.max(c.progress.total, 1)) * 100)
    : 0;

  return (
    <div className={`path-row ${completed ? "path-row-done" : ""}`}>
      <div className="path-row-step">
        <div className={`path-row-dot ${completed ? "done" : started ? "cur" : ""}`}>
          {completed ? <Check size={14} /> : started ? <CircleDot size={14} /> : index + 1}
        </div>
        {index < total - 1 && <div className={`path-row-line ${completed ? "done" : ""}`} />}
      </div>

      <div className="path-row-body">
        <div className="path-row-top">
          <span className="course-icon" style={{ flexShrink: 0 }}>
            <BookOpen size={18} />
          </span>
          <div className="path-row-info">
            <span className="course-title">{c.title}</span>
            <span className="muted-sm">{c.module_count} modules · {c.lesson_count} lessons</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onOpen}>
            {completed ? "Review" : started ? "Continue" : "Start"} <ArrowRight size={13} />
          </button>
        </div>
        {started && (
          <div className="course-progress" style={{ marginTop: "0.5rem" }}>
            <div className="course-progress-track">
              <div className="course-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="course-progress-pct">{pct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
