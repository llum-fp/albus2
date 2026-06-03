/* Seguimiento de progreso de cursos por usuario, persistido en localStorage.
   No hay backend para esto todavía: cada perfil (Admin/Technical/Sales) tiene su
   propio mapa de progreso. */

export interface CourseProgress {
  furthest: number; // índice (0-based) de la lección más avanzada alcanzada
  total: number; // nº total de lecciones del curso
  completed: boolean;
  updatedAt: number; // epoch ms
}

type ProgressMap = Record<string, CourseProgress>;

const keyFor = (user: string) => `albus_progress_${user}`;

export function getProgressMap(user: string): ProgressMap {
  try {
    const raw = localStorage.getItem(keyFor(user));
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function getProgress(user: string, courseId: string): CourseProgress | undefined {
  return getProgressMap(user)[courseId];
}

function save(user: string, map: ProgressMap) {
  localStorage.setItem(keyFor(user), JSON.stringify(map));
}

/* Registra que el usuario ha alcanzado la lección `lessonIndex` (0-based) de un
   curso con `total` lecciones. Marca el curso como acabado si llega a la última.
   Solo avanza el "furthest" (nunca retrocede). */
export function recordProgress(
  user: string,
  courseId: string,
  lessonIndex: number,
  total: number,
) {
  const map = getProgressMap(user);
  const prev = map[courseId];
  const furthest = Math.max(prev?.furthest ?? 0, lessonIndex);
  const completed = (prev?.completed ?? false) || furthest >= total - 1;
  map[courseId] = { furthest, total, completed, updatedAt: Date.now() };
  save(user, map);
}

/* Marca explícitamente un curso como acabado (botón Finalizar). */
export function markCompleted(user: string, courseId: string, total: number) {
  const map = getProgressMap(user);
  map[courseId] = {
    furthest: Math.max(map[courseId]?.furthest ?? 0, total - 1),
    total,
    completed: true,
    updatedAt: Date.now(),
  };
  save(user, map);
}

/* Porcentaje 0-100 de avance. */
export function progressPct(p: CourseProgress | undefined): number {
  if (!p || p.total <= 0) return 0;
  if (p.completed) return 100;
  return Math.min(100, Math.round(((p.furthest + 1) / p.total) * 100));
}

/* ── Encuestas: marca si el usuario ya valoró un curso (para no repetir) ── */

const surveyKey = (user: string) => `albus_surveyed_${user}`;

export function hasSurveyed(user: string, courseId: string): boolean {
  try {
    const raw = localStorage.getItem(surveyKey(user));
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return ids.includes(courseId);
  } catch {
    return false;
  }
}

export function markSurveyed(user: string, courseId: string) {
  try {
    const raw = localStorage.getItem(surveyKey(user));
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(courseId)) {
      ids.push(courseId);
      localStorage.setItem(surveyKey(user), JSON.stringify(ids));
    }
  } catch {
    /* noop */
  }
}
