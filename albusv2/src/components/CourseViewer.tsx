import { useEffect, useMemo, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import { fetchCourse, type Course, type Question } from "../api";
import { recordProgress, markCompleted, hasSurveyed } from "../progress";
import { useChat } from "../useChat";
import type { UserRole } from "./Login";
import QuizQuestion from "./QuizQuestion";
import ChatPanel from "./ChatPanel";
import Survey from "./Survey";
import ThemeToggle from "./ThemeToggle";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  PanelLeft,
  MessageSquare,
  Check,
  CircleDot,
} from "./icons";
import AlbusIcon from "./AlbusIcon";

type QuizState = Record<string, { selected: number; correct: boolean; unlocked: boolean }>;

// Nº de preguntas que se muestran por lección (elegidas al azar del pool).
const QUIZ_QUESTIONS_PER_LESSON = 2;

// Muestra n preguntas al azar del pool, conservando el orden original.
function sampleQuestions(pool: Question[], n: number): Question[] {
  if (pool.length <= n) return [...pool];
  const idxs = pool.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs
    .slice(0, n)
    .sort((a, b) => a - b)
    .map((i) => pool[i]);
}

export default function CourseViewer({
  courseId,
  user,
  onBack,
}: {
  courseId: string;
  user: UserRole;
  onBack: () => void;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [active, setActive] = useState(0); // índice lineal sobre todas las lecciones
  const [view, setView] = useState<"lesson" | "quiz">("lesson");
  const [qIndex, setQIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(360);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  const [quiz, setQuiz] = useState<QuizState>({});
  const [pendingWrong, setPendingWrong] = useState<{ questionId: string; chosenIndex: number } | null>(null);
  // Preguntas elegidas al azar por lección (estable mientras dure la sesión).
  const [quizPick, setQuizPick] = useState<Record<string, Question[]>>({});
  const [showSurvey, setShowSurvey] = useState(false);

  const chat = useChat(courseId);

  useEffect(() => {
    setState("loading");
    fetchCourse(courseId)
      .then((c) => {
        setCourse(c);
        setActive(0);
        setView("lesson");
        setQIndex(0);
        setOpenModules(new Set(c.modules.map((_, i) => i)));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [courseId]);

  const flat = useMemo(() => {
    if (!course) return [];
    const out: { moduleIdx: number; lesson: Course["modules"][0]["lessons"][0] }[] = [];
    course.modules.forEach((m, mi) => {
      m.lessons.forEach((l) => out.push({ moduleIdx: mi, lesson: l }));
    });
    return out;
  }, [course]);

  // Registrar progreso: la lección alcanzada (la más avanzada) para "Mis cursos".
  useEffect(() => {
    if (state === "ready" && flat.length > 0) {
      recordProgress(user, courseId, active, flat.length);
    }
  }, [state, active, flat.length, user, courseId]);

  if (state !== "ready" || !course) {
    return (
      <div className="viewer-fallback">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to courses
        </button>
        <p className="muted">
          {state === "loading" ? "Loading course…" : "Couldn't load the course."}
        </p>
      </div>
    );
  }

  const total = flat.length;
  const current = flat[active];
  const lesson = current.lesson;
  const lessonId = lesson.id;
  // En el quiz se usa la selección al azar; en la pantalla de lección, el pool
  // completo basta para decidir si hay quiz (questions.length > 0).
  const questions = quizPick[lessonId] ?? lesson.questions ?? [];

  let runningIndex = 0;
  const moduleBaseIndex = course.modules.map((m) => {
    const base = runningIndex;
    runningIndex += m.lessons.length;
    return base;
  });

  const toggleModule = (mi: number) =>
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(mi) ? next.delete(mi) : next.add(mi);
      return next;
    });

  const goToLesson = (idx: number) => {
    setActive(idx);
    setView("lesson");
    setQIndex(0);
  };

  // ── Quiz: selección de respuesta ──
  const onSelectAnswer = (answerIdx: number) => {
    const q = questions[qIndex];
    if (!q || quiz[q.id]) return; // ya respondida
    const correct = answerIdx === q.correctAnswerIndex;
    setQuiz((prev) => ({ ...prev, [q.id]: { selected: answerIdx, correct, unlocked: false } }));
    setChatOpen(true);

    const unlock = () =>
      setQuiz((prev) => ({ ...prev, [q.id]: { ...prev[q.id], unlocked: true } }));

    if (correct) {
      chat.sendQuiz({ phase: "correct", questionId: q.id, chosenIndex: answerIdx, lessonId }).then(unlock);
    } else {
      setPendingWrong({ questionId: q.id, chosenIndex: answerIdx });
      chat.sendQuiz({ phase: "wrong_ask", questionId: q.id, chosenIndex: answerIdx, lessonId });
      // Next sigue bloqueado hasta que el alumno responda a Albus (handleUserSend).
    }
  };

  // ── Envío desde el input del chat (intercepta la respuesta forzada del quiz) ──
  const handleUserSend = (text: string) => {
    if (pendingWrong) {
      const pw = pendingWrong;
      setPendingWrong(null);
      chat
        .sendQuiz({ phase: "wrong_explain", questionId: pw.questionId, chosenIndex: pw.chosenIndex, userText: text, lessonId })
        .then(() =>
          setQuiz((prev) => ({ ...prev, [pw.questionId]: { ...prev[pw.questionId], unlocked: true } })),
        );
    } else {
      chat.sendUser(text, lessonId);
    }
  };

  // ── Navegación dentro del quiz ──
  const cq = questions[qIndex];
  const canAdvance = cq ? !!quiz[cq.id]?.unlocked : true;

  // Finalizar el curso: marcar acabado y, si no lo ha valorado aún, lanzar el survey.
  const finishCourse = () => {
    markCompleted(user, courseId, total);
    if (hasSurveyed(user, courseId)) {
      onBack();
    } else {
      setShowSurvey(true);
    }
  };

  const nextFromQuiz = () => {
    if (qIndex < questions.length - 1) {
      setQIndex((i) => i + 1);
    } else if (active < total - 1) {
      goToLesson(active + 1);
    } else {
      // Última pregunta de la última lección -> curso finalizado.
      finishCourse();
    }
  };

  const isQuiz = view === "quiz";

  return (
    <div
      className={`viewer ${chatOpen ? "with-chat" : ""}`}
      style={{ ["--chat-w" as string]: `${chatWidth}px` } as CSSProperties}
    >
      {/* ── Sidebar ── */}
      <nav className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          {sidebarOpen && (
            <>
              <span className="brand-mark sm">
                <AlbusIcon size={18} />
              </span>
              <span className="sidebar-brand-name">Contents</span>
            </>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Collapse index" : "Expand index"}
          >
            <PanelLeft size={18} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>

        <div className="sidebar-list">
          {course.modules.map((m, mi) => {
            const base = moduleBaseIndex[mi];
            const moduleOpen = openModules.has(mi);
            const hasActive = active >= base && active < base + m.lessons.length;
            return (
              <div key={m.id} className="module-group">
                <button
                  className={`module-head ${hasActive ? "has-active" : ""}`}
                  onClick={() => toggleModule(mi)}
                  title={m.title}
                >
                  <span className="module-chevron">
                    {moduleOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {sidebarOpen ? (
                    <span className="module-head-text">
                      <span className="module-num">Module {mi + 1}</span>
                      <span className="module-title">{m.title}</span>
                    </span>
                  ) : (
                    <span className="module-num-collapsed">{mi + 1}</span>
                  )}
                </button>

                {moduleOpen &&
                  m.lessons.map((l, li) => {
                    const idx = base + li;
                    const done = idx < active;
                    const cur = idx === active;
                    return (
                      <button
                        key={l.id}
                        className={`lesson-item ${cur ? "active" : ""}`}
                        onClick={() => goToLesson(idx)}
                        title={l.title}
                      >
                        <span className={`lesson-dot ${done ? "done" : cur ? "cur" : ""}`}>
                          {done ? <Check size={12} /> : cur ? <CircleDot size={12} /> : li + 1}
                        </span>
                        {sidebarOpen && <span className="lesson-item-text">{l.title}</span>}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>

        <button className="sidebar-back" onClick={onBack} title="Back to courses">
          <ArrowLeft size={16} />
          {sidebarOpen && <span>Back to courses</span>}
        </button>
      </nav>

      {/* ── Centro ── */}
      <main className="content">
        <header className="content-header">
          <img
            src="/logos/OmniAccess_Symbol-positive_sRGB.svg"
            className="header-logo logo-on-light"
            alt="OmniAccess"
          />
          <img
            src="/logos/OmniAccess_Symbol-negative_sRGB.svg"
            className="header-logo logo-on-dark"
            alt="OmniAccess"
          />
          <div className="content-title-wrap">
            <h1 className="content-course-title">{course.title}</h1>
            <span className="eyebrow">
              Module {current.moduleIdx + 1} · Lesson {active + 1} of {total}
              {isQuiz ? " · Quiz" : ""}
            </span>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            {!chatOpen && (
              <button
                className="icon-btn"
                onClick={() => setChatOpen(true)}
                title="Open assistant"
              >
                <MessageSquare size={18} />
              </button>
            )}
          </div>
        </header>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((active + 1) / total) * 100}%` }} />
        </div>

        {/* ── Vista LECCIÓN ── */}
        {!isQuiz && (
          <article className="lesson">
            <h2 className="lesson-title">{lesson.title}</h2>
            <div className="lesson-body markdown">
              <ReactMarkdown>{lesson.content}</ReactMarkdown>
            </div>

            <nav className="lesson-nav">
              <button
                className="btn btn-secondary"
                disabled={active === 0}
                onClick={() => goToLesson(active - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              {questions.length > 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!quizPick[lessonId]) {
                      setQuizPick((prev) => ({
                        ...prev,
                        [lessonId]: sampleQuestions(lesson.questions || [], QUIZ_QUESTIONS_PER_LESSON),
                      }));
                    }
                    setChatOpen(true);
                    setQIndex(0);
                    setView("quiz");
                  }}
                >
                  Go to quiz <ChevronRight size={16} />
                </button>
              ) : active < total - 1 ? (
                <button className="btn btn-primary" onClick={() => goToLesson(active + 1)}>
                  Next lesson <ChevronRight size={16} />
                </button>
              ) : (
                <button className="btn btn-primary" onClick={finishCourse}>
                  Finish course <Check size={16} />
                </button>
              )}
            </nav>
          </article>
        )}

        {/* ── Vista QUIZ ── */}
        {isQuiz && cq && (
          <article className="lesson">
            <QuizQuestion
              q={cq}
              index={qIndex}
              total={questions.length}
              selected={quiz[cq.id]?.selected ?? null}
              onSelect={onSelectAnswer}
            />

            <nav className="lesson-nav">
              <button className="btn btn-secondary" onClick={() => setView("lesson")}>
                <ChevronLeft size={16} /> Lesson
              </button>
              <div className="quiz-next-wrap">
                {!quiz[cq.id] && (
                  <span className="quiz-hint">Select an answer</span>
                )}
                {quiz[cq.id] && !canAdvance && (
                  <span className="quiz-hint">
                    <AlbusIcon size={13} /> Albus is replying in the chat
                  </span>
                )}
                <button
                  className="btn btn-primary"
                  disabled={!canAdvance}
                  onClick={nextFromQuiz}
                >
                  {qIndex < questions.length - 1
                    ? "Next question"
                    : active < total - 1
                    ? "Next lesson"
                    : "Finish"}
                  <ChevronRight size={16} />
                </button>
              </div>
            </nav>
          </article>
        )}
      </main>

      {/* ── Chat (Albus) ── */}
      {chatOpen && (
        <ChatPanel
          messages={chat.messages}
          streaming={chat.streaming}
          onSend={handleUserSend}
          canClose={!isQuiz}
          onClose={() => setChatOpen(false)}
          notice={pendingWrong ? "✋ Reply to Albus to continue." : undefined}
          onResize={setChatWidth}
        />
      )}

      {showSurvey && (
        <Survey
          courseId={courseId}
          courseTitle={course.title}
          user={user}
          onClose={() => {
            setShowSurvey(false);
            onBack();
          }}
          onDone={() => {
            setShowSurvey(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}
