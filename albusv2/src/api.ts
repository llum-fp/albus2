export interface Question {
  id: string;
  question: string;
  answers: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface LessonImage {
  path: string; // relative, e.g. "images/<session>/<file>.png"
  caption?: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  images?: LessonImage[];
  questions: Question[];
}

/** Turn a course JSON image path ("images/<session>/x.png") into a served URL
   ("/api/media/<session>/x.png"). platform_back mounts the images dir at
   /api/media; the Vite proxy forwards /api → :8001. */
export function mediaUrl(path: string): string {
  return `/api/media/${path.replace(/^images\//, "").replace(/^\/+/, "")}`;
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
  duration_min?: number | null;
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
  // Send the role so the catalog is filtered to what this user may see.
  const r = await fetch("/api/courses", { headers: { "X-Albus-Role": storedRole() } });
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
  user_id: number;
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

export async function checkSurveyed(userId: number, courseId: string): Promise<boolean> {
  const p = new URLSearchParams({ user_id: String(userId), course_id: courseId });
  const r = await fetch(`/api/surveys/check?${p}`);
  if (!r.ok) return false;
  const data = await r.json();
  return data.surveyed as boolean;
}

/* The signed-in identity (stub auth). Picked on the login screen from the real
   users, stored as JSON in localStorage["albus_user"]. The role drives admin
   gating; id keys per-user progress; name labels surveys. */
export interface SessionUser {
  id: number;
  name: string;
  role: string;
}

/** Stable localStorage key for a user's progress/surveys (id survives renames). */
export const userKey = (u: SessionUser) => `u${u.id}`;

/** Real users for the login picker (public; id/name/role only). */
export async function fetchUsers(): Promise<SessionUser[]> {
  const r = await fetch("/api/users");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* Confluence page search (backend /api/find-pages — fast, no LLM). Used by the
   admin "New course" picker so you search by topic instead of typing page ids. */
export interface ConfluencePage {
  page_id: number | string;
  page_title: string;
  brief_description: string;
}

export async function findPages(topic: string, limit = 8): Promise<ConfluencePage[]> {
  const p = new URLSearchParams({ topic, limit: String(limit) });
  const r = await fetch(`/api/find-pages?${p.toString()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.pages ?? [];
}

/** Resolve a single page by its id (returns null if it doesn't exist). */
export async function findPage(pageId: string): Promise<ConfluencePage | null> {
  const r = await fetch(`/api/page/${encodeURIComponent(pageId)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export interface ProgressRecord {
  furthest: number;
  total: number;
  completed: boolean;
  updated_at: string;
}

export type RemoteProgressMap = Record<string, ProgressRecord>;

export async function fetchUserProgress(userId: number): Promise<RemoteProgressMap> {
  const r = await fetch(`/api/progress/${userId}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function upsertProgress(
  userId: number,
  courseId: string,
  furthest: number,
  total: number,
  completed: boolean,
): Promise<void> {
  await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, course_id: courseId, furthest, total, completed }),
  });
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

/* ──────────────────────────────────────────────────────────────────────────
   Admin console (/api/admin/*). Every call carries the X-Albus-Role header,
   read from the same localStorage slot the login stub writes. This is UI
   gating, not real auth (the header is client-controlled) — see the backend.
   ────────────────────────────────────────────────────────────────────────── */

const USER_KEY = "albus_user";

/** Role of the signed-in user, read from the stored identity (for the gate). */
export function storedRole(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? ((JSON.parse(raw) as SessionUser).role ?? "") : "";
  } catch {
    return "";
  }
}

function adminHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { "X-Albus-Role": storedRole() };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/admin${path}`, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (r.status === 204) return undefined as T;
  return r.json();
}

export type BuildStatus = "pending" | "completed" | "failed";
export type CourseProfile = "technical" | "sales";

export interface AdminCourse {
  id: string; // filename-stem id the learner UI uses
  db_id: number;
  session_id: string | null;
  title: string | null;
  description: string | null;
  language: string | null;
  profile: string | null;
  duration_min: number | null;
  status: BuildStatus;
  published: boolean;
  module_count: number;
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminCourseDetail extends AdminCourse {
  content: Course | null;
}

export type BuildStage = "reading_source" | "writing_course" | "finishing" | "done" | "failed";

export interface BuildJob {
  db_id: number;
  session_id: string | null;
  title: string | null;
  page_id: string[] | null;
  profile: string | null;
  status: BuildStatus;
  running: boolean;
  stage?: BuildStage | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface SurveyRecord {
  id: number;
  course_id: string;
  user: string;
  rating_overall: number;
  rating_content: number;
  rating_albus: number;
  rating_applicability: number;
  difficulty: string;
  duration: string;
  comments: string | null;
  submitted_at: string;
}

export interface SurveyStats {
  course_id: string;
  count: number;
  averages: Record<string, number>;
  difficulty: Record<string, number>;
  duration: Record<string, number>;
}

export interface SurveysResponse {
  records: SurveyRecord[];
  stats: SurveyStats[];
}

export interface NewCourseInput {
  page_id?: string | string[];
  topic?: string;
  profile?: CourseProfile;
  duration_min?: number;
  harcoded?: boolean;
}

// Courses
export const adminFetchCourses = () => adminFetch<AdminCourse[]>("/courses", { headers: adminHeaders() });
export const adminFetchCourse = (dbId: number) =>
  adminFetch<AdminCourseDetail>(`/courses/${dbId}`, { headers: adminHeaders() });
export const adminCreateCourse = (body: NewCourseInput) =>
  adminFetch<{ db_id: number; status: BuildStatus }>("/courses", {
    method: "POST",
    headers: adminHeaders(true),
    body: JSON.stringify(body),
  });
export const adminReviseCourse = (dbId: number, feedback: string) =>
  adminFetch<{ db_id: number; status: BuildStatus }>(`/courses/${dbId}`, {
    method: "PATCH",
    headers: adminHeaders(true),
    body: JSON.stringify({ feedback }),
  });
export const adminUpdateCourseDetails = (
  dbId: number,
  body: { title?: string; description?: string; profile?: string; duration_min?: number | null },
) =>
  adminFetch<AdminCourse>(`/courses/${dbId}/details`, {
    method: "PATCH",
    headers: adminHeaders(true),
    body: JSON.stringify(body),
  });
export const adminPublish = (dbId: number) =>
  adminFetch<AdminCourse>(`/courses/${dbId}/publish`, { method: "POST", headers: adminHeaders() });
export const adminUnpublish = (dbId: number) =>
  adminFetch<AdminCourse>(`/courses/${dbId}/unpublish`, { method: "POST", headers: adminHeaders() });

// Activity / jobs
export const adminFetchJobs = () => adminFetch<BuildJob[]>("/jobs", { headers: adminHeaders() });

// Users
export const adminFetchUsers = () => adminFetch<User[]>("/users", { headers: adminHeaders() });
export const adminCreateUser = (body: { email: string; name: string; role: string }) =>
  adminFetch<User>("/users", { method: "POST", headers: adminHeaders(true), body: JSON.stringify(body) });
export const adminUpdateUser = (id: number, body: { name?: string; email?: string; role?: string }) =>
  adminFetch<User>(`/users/${id}`, { method: "PATCH", headers: adminHeaders(true), body: JSON.stringify(body) });
export const adminDeleteUser = (id: number) =>
  adminFetch<void>(`/users/${id}`, { method: "DELETE", headers: adminHeaders() });

// Surveys
export const adminFetchSurveys = () => adminFetch<SurveysResponse>("/surveys", { headers: adminHeaders() });

// ── Learning Paths ────────────────────────────────────────────────────────────

export interface PathCourse {
  course_session_id: string;
  position: number;
}

export interface AdminPath {
  id: number;
  title: string;
  description: string | null;
  profile: string | null;
  published: boolean;
  course_count: number;
  created_at: string;
  updated_at: string;
  courses: PathCourse[];
}

export interface PathCourseSummary {
  id: string;
  title: string;
  description: string;
  language?: string;
  module_count: number;
  lesson_count: number;
  duration_min?: number | null;
  position: number;
  progress: { furthest: number; total: number; completed: boolean } | null;
}

export interface PathSummary {
  id: number;
  title: string;
  description: string | null;
  profile: string | null;
  course_count: number;
  completed_count: number;
}

export interface PathDetail extends PathSummary {
  courses: PathCourseSummary[];
}

// Learner
export async function fetchPaths(userId: number): Promise<PathSummary[]> {
  const r = await fetch(`/api/paths?user_id=${userId}`, {
    headers: { "X-Albus-Role": storedRole() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchPath(pathId: number, userId: number): Promise<PathDetail> {
  const r = await fetch(`/api/paths/${pathId}?user_id=${userId}`, {
    headers: { "X-Albus-Role": storedRole() },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Admin
export const adminFetchPaths = () =>
  adminFetch<AdminPath[]>("/paths", { headers: adminHeaders() });
export const adminCreatePath = (body: { title: string; description?: string; profile?: string | null }) =>
  adminFetch<AdminPath>("/paths", { method: "POST", headers: adminHeaders(true), body: JSON.stringify(body) });
export const adminUpdatePath = (id: number, body: { title?: string; description?: string; profile?: string | null }) =>
  adminFetch<AdminPath>(`/paths/${id}`, { method: "PATCH", headers: adminHeaders(true), body: JSON.stringify(body) });
export const adminPublishPath = (id: number) =>
  adminFetch<AdminPath>(`/paths/${id}/publish`, { method: "POST", headers: adminHeaders() });
export const adminUnpublishPath = (id: number) =>
  adminFetch<AdminPath>(`/paths/${id}/unpublish`, { method: "POST", headers: adminHeaders() });
export const adminSetPathCourses = (id: number, courses: PathCourse[]) =>
  adminFetch<AdminPath>(`/paths/${id}/courses`, {
    method: "PUT",
    headers: adminHeaders(true),
    body: JSON.stringify({ courses }),
  });
export const adminDeletePath = (id: number) =>
  adminFetch<{ ok: boolean }>(`/paths/${id}`, { method: "DELETE", headers: adminHeaders() });
