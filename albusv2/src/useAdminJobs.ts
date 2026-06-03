import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetchJobs, type BuildJob } from "./api";

/* Polls GET /api/admin/jobs with an adaptive cadence: fast (`activeMs`) while a
   build is running, slow (`idleMs`) when idle — so a newly launched build is
   picked up without restarting the hook, but we don't hammer the API when
   nothing is happening. Jobs live in the DB, so running builds survive reloads. */
export function useAdminJobs(activeMs = 4000, idleMs = 15000) {
  const [jobs, setJobs] = useState<BuildJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const fetchOnce = useCallback(async (): Promise<BuildJob[] | null> => {
    try {
      const data = await adminFetchJobs();
      if (alive.current) {
        setJobs(data);
        setError(null);
      }
      return data;
    } catch {
      if (alive.current) setError("Couldn't load build activity.");
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const tick = async () => {
      const data = await fetchOnce();
      if (!alive.current) return;
      const running = !!data && data.some((j) => j.running);
      timer.current = setTimeout(tick, running ? activeMs : idleMs);
    };
    tick();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fetchOnce, activeMs, idleMs]);

  const refresh = useCallback(() => {
    fetchOnce();
  }, [fetchOnce]);

  return { jobs, loading, error, refresh };
}
