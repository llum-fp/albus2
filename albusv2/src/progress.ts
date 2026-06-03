/* Seguimiento de progreso de cursos por usuario.
   localStorage actúa como caché local para lectura inmediata; el backend es
   la fuente de verdad y se sincroniza de forma asíncrona en ambas direcciones. */

import { fetchUserProgress, upsertProgress, type SessionUser } from "./api";

export interface CourseProgress {
  furthest: number; // índice (0-based) de la lección más avanzada alcanzada
  total: number;    // nº total de lecciones del curso
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

/* Carga el progreso desde el backend y lo fusiona en localStorage.
   Solo avanza el "furthest" — nunca retrocede. Devuelve el mapa actualizado. */
export async function syncProgressFromBackend(
  sessionUser: SessionUser,
  userKey: string,
): Promise<ProgressMap> {
  try {
    const remote = await fetchUserProgress(sessionUser.id);
    const local = getProgressMap(userKey);
    for (const [courseId, r] of Object.entries(remote)) {
      const prev = local[courseId];
      local[courseId] = {
        furthest: Math.max(prev?.furthest ?? 0, r.furthest),
        total: r.total,
        completed: (prev?.completed ?? false) || r.completed,
        updatedAt: new Date(r.updated_at).getTime(),
      };
    }
    save(userKey, local);
    return local;
  } catch {
    return getProgressMap(userKey);
  }
}

/* Registra que el usuario ha alcanzado la lección `lessonIndex` (0-based) de un
   curso con `total` lecciones. Marca el curso como acabado si llega a la última.
   Solo avanza el "furthest" (nunca retrocede). */
export function recordProgress(
  user: string,
  courseId: string,
  lessonIndex: number,
  total: number,
  sessionUser?: SessionUser,
) {
  const map = getProgressMap(user);
  const prev = map[courseId];
  const furthest = Math.max(prev?.furthest ?? 0, lessonIndex);
  const completed = (prev?.completed ?? false) || furthest >= total - 1;
  map[courseId] = { furthest, total, completed, updatedAt: Date.now() };
  save(user, map);
  if (sessionUser) {
    upsertProgress(sessionUser.id, courseId, furthest, total, completed).catch(() => {});
  }
}

/* Marca explícitamente un curso como acabado (botón Finalizar). */
export function markCompleted(
  user: string,
  courseId: string,
  total: number,
  sessionUser?: SessionUser,
) {
  const map = getProgressMap(user);
  const furthest = Math.max(map[courseId]?.furthest ?? 0, total - 1);
  map[courseId] = { furthest, total, completed: true, updatedAt: Date.now() };
  save(user, map);
  if (sessionUser) {
    upsertProgress(sessionUser.id, courseId, furthest, total, true).catch(() => {});
  }
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
