import { upsertProgress, type SessionUser } from "./api";

export interface CourseProgress {
  furthest: number;
  total: number;
  completed: boolean;
  updatedAt: number;
}

/* Porcentaje 0-100 de avance. */
export function progressPct(p: CourseProgress | undefined): number {
  if (!p || p.total <= 0) return 0;
  if (p.completed) return 100;
  return Math.min(100, Math.round(((p.furthest + 1) / p.total) * 100));
}

/* Registra que el usuario ha alcanzado la lección `lessonIndex` (0-based).
   El backend aplica max(existing, provided) — nunca retrocede. */
export async function recordProgress(
  courseId: string,
  lessonIndex: number,
  total: number,
  sessionUser: SessionUser,
): Promise<void> {
  const completed = lessonIndex >= total - 1;
  await upsertProgress(sessionUser.id, courseId, lessonIndex, total, completed).catch(() => {});
}

/* Marca explícitamente un curso como acabado (botón Finalizar). */
export async function markCompleted(
  courseId: string,
  total: number,
  sessionUser: SessionUser,
): Promise<void> {
  await upsertProgress(sessionUser.id, courseId, total - 1, total, true).catch(() => {});
}

