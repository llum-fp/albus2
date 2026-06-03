export interface Question {
  id: string;
  question: string;
  answers: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  questions: Question[];
}

export interface Module {
  id: string;
  title: string;
  summary?: string;
  lessons: Lesson[];
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  language?: string;
  module_count: number;
  lesson_count: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  source?: string;
  language?: string;
  modules: Module[];
}

export async function fetchCourses(): Promise<CourseSummary[]> {
  const r = await fetch("/api/courses");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchCourse(courseId: string): Promise<Course> {
  const r = await fetch(`/api/courses/${courseId}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export interface SurveyPayload {
  course_id: string;
  user: string;
  rating_overall: number;
  rating_content: number;
  rating_albus: number;
  rating_applicability: number;
  difficulty: string;
  duration: string;
  comments: string;
}

export async function submitSurvey(payload: SurveyPayload): Promise<void> {
  const r = await fetch("/api/surveys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

export async function createChatSession(): Promise<number> {
  const r = await fetch("/api/chat/session", { method: "POST" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.session_id as number;
}

export type QuizPhase = "correct" | "wrong_ask" | "wrong_explain";

export interface ChatStreamOpts {
  courseId: string;
  sessionId: number;
  lessonId?: string;
  message?: string;
  quizPhase?: QuizPhase;
  questionId?: string;
  chosenIndex?: number;
}

export function chatStreamUrl(o: ChatStreamOpts): string {
  const p = new URLSearchParams();
  p.set("course_id", o.courseId);
  p.set("session_id", String(o.sessionId));
  if (o.message) p.set("message", o.message);
  if (o.lessonId) p.set("lesson_id", o.lessonId);
  if (o.quizPhase) p.set("quiz_phase", o.quizPhase);
  if (o.questionId) p.set("question_id", o.questionId);
  if (o.chosenIndex != null) p.set("chosen_index", String(o.chosenIndex));
  return `/api/chat/stream?${p.toString()}`;
}
