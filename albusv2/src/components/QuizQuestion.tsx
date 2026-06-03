import type { Question } from "../api";
import { Check, X } from "./icons";

/* Una sola pregunta del quiz, en su propia pantalla. El feedback explicativo lo da
   Albus en el chat; aquí solo se marca visualmente la opción correcta/incorrecta. */
export default function QuizQuestion({
  q,
  index,
  total,
  selected,
  onSelect,
}: {
  q: Question;
  index: number; // 0-based
  total: number;
  selected: number | null;
  onSelect: (answerIndex: number) => void;
}) {
  const answered = selected !== null;
  const correctIdx = q.correctAnswerIndex;

  return (
    <div className="quiz-screen">
      <p className="eyebrow">
        Question {index + 1} of {total}
      </p>
      <div className="quiz-question">
        <span className="quiz-num">{index + 1}</span>
        {q.question}
      </div>
      <div className="quiz-options">
        {q.answers.map((opt, i) => {
          const isCorrect = i === correctIdx;
          const isPicked = i === selected;
          let cls = "quiz-option";
          if (answered) {
            if (isCorrect) cls += " correct";
            else if (isPicked) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button
              key={i}
              className={cls}
              disabled={answered}
              onClick={() => onSelect(i)}
            >
              <span className="quiz-marker">
                {answered && isCorrect && <Check size={15} />}
                {answered && isPicked && !isCorrect && <X size={15} />}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
