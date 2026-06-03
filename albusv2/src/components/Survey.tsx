import { useState } from "react";
import { Star, X } from "./icons";
import { submitSurvey, type SessionUser } from "../api";

/* Encuesta de fin de curso. Estrellas 1-5 para varias dimensiones, escalas para
   dificultad y duración, y un textbox de comentarios. Se muestra al acabar. */

const DIFFICULTY = [
  { value: "muy_facil", label: "Very easy" },
  { value: "facil", label: "Easy" },
  { value: "adecuada", label: "Just right" },
  { value: "dificil", label: "Hard" },
  { value: "muy_dificil", label: "Very hard" },
];

const DURATION = [
  { value: "corta", label: "Too short" },
  { value: "adecuada", label: "Just right" },
  { value: "larga", label: "Too long" },
];

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            className={`star ${on ? "on" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star size={26} fill={on ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

export default function Survey({
  courseId,
  courseTitle,
  user,
  onClose,
  onDone,
}: {
  courseId: string;
  courseTitle: string;
  user: SessionUser;
  onClose: () => void; // omitir / cerrar sin guardar
  onDone: () => void; // enviado correctamente
}) {
  const [overall, setOverall] = useState(0);
  const [content, setContent] = useState(0);
  const [albus, setAlbus] = useState(0);
  const [applicability, setApplicability] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const [duration, setDuration] = useState("");
  const [comments, setComments] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    overall > 0 &&
    content > 0 &&
    albus > 0 &&
    applicability > 0 &&
    difficulty !== "" &&
    duration !== "";

  const submit = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitSurvey({
        course_id: courseId,
        user_id: user.id,
        user: user.name,
        rating_overall: overall,
        rating_content: content,
        rating_albus: albus,
        rating_applicability: applicability,
        difficulty,
        duration,
        comments: comments.trim(),
      });
      onDone();
    } catch {
      setError("Couldn't submit your feedback. Please try again.");
      setSending(false);
    }
  };

  return (
    <div className="survey-overlay" role="dialog" aria-modal="true">
      <div className="survey-card">
        <button className="survey-close icon-btn" onClick={onClose} title="Skip">
          <X size={18} />
        </button>

        <div className="survey-head">
          <span className="survey-emoji">🎉</span>
          <h2 className="survey-title">You finished the course!</h2>
          <p className="survey-sub">{courseTitle}</p>
          <p className="muted-sm">Your feedback helps us improve. It'll only take a moment.</p>
        </div>

        <div className="survey-fields">
          <label className="survey-field">
            <span className="survey-label">Overall rating</span>
            <Stars value={overall} onChange={setOverall} />
          </label>
          <label className="survey-field">
            <span className="survey-label">Content quality</span>
            <Stars value={content} onChange={setContent} />
          </label>
          <label className="survey-field">
            <span className="survey-label">Did Albus (the tutor) help you?</span>
            <Stars value={albus} onChange={setAlbus} />
          </label>
          <label className="survey-field">
            <span className="survey-label">Applicability to your job</span>
            <Stars value={applicability} onChange={setApplicability} />
          </label>

          <div className="survey-field">
            <span className="survey-label">Difficulty</span>
            <div className="seg">
              {DIFFICULTY.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`seg-btn ${difficulty === d.value ? "active" : ""}`}
                  onClick={() => setDifficulty(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="survey-field">
            <span className="survey-label">Course length</span>
            <div className="seg">
              {DURATION.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`seg-btn ${duration === d.value ? "active" : ""}`}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <label className="survey-field">
            <span className="survey-label">Suggestions or comments (optional)</span>
            <textarea
              className="survey-textarea"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="What would you improve? What did you find most useful?"
            />
          </label>
        </div>

        {error && <p className="survey-error">{error}</p>}

        <div className="survey-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={sending}>
            Skip
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!ready || sending}>
            {sending ? "Submitting…" : "Submit feedback"}
          </button>
        </div>
        {!ready && (
          <p className="survey-hint">Complete the ratings and scales to submit.</p>
        )}
      </div>
    </div>
  );
}
