import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetchLogs, type LogService } from "../api";
import { Download, RefreshCw } from "./icons";

const SERVICES: { id: LogService; label: string }[] = [
  { id: "platform_back", label: "platform_back" },
  { id: "agents_back", label: "agents_back" },
  { id: "albusv2", label: "albusv2" },
];

function lineClass(line: string): string {
  const u = line.toUpperCase();
  if (u.includes("ERROR") || u.includes("CRITICAL")) return "log-error";
  if (u.includes("WARNING") || u.includes("WARN")) return "log-warn";
  return "";
}

export default function AdminLogs() {
  const [service, setService] = useState<LogService>("platform_back");
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const atBottomRef = useRef(true);
  const viewerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (svc: LogService) => {
    try {
      const data = await adminFetchLogs(svc, 200);
      setLines(data.lines);
      setError(null);
    } catch {
      setError("No se pudo cargar el log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setLines([]);
    atBottomRef.current = true;
    load(service);
  }, [service, load]);

  useEffect(() => {
    if (!autoRefresh) return;
    timerRef.current = setInterval(() => load(service), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, service, load]);

  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView();
  }, [lines]);

  function exportLog() {
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${service}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onScroll() {
    const el = viewerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>Logs</h2>
          <p className="sub">Últimas 200 líneas · refresco cada 5 s</p>
        </div>
      </div>

      <div className="admin-toolbar">
        {SERVICES.map(({ id, label }) => (
          <button
            key={id}
            className={`chip ${service === id ? "active" : ""}`}
            onClick={() => setService(id)}
          >
            {label}
          </button>
        ))}
        <label className="log-auto-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <button className="icon-btn" onClick={() => load(service)} title="Refrescar ahora">
          <RefreshCw size={15} />
        </button>
        <button className="icon-btn" onClick={exportLog} disabled={lines.length === 0} title="Exportar .log">
          <Download size={15} />
        </button>
      </div>

      {loading && <div className="admin-loading">Cargando…</div>}
      {error && <div className="admin-error">{error}</div>}
      {!loading && !error && (
        <div className="log-viewer" ref={viewerRef} onScroll={onScroll}>
          {lines.length === 0 ? (
            <span className="log-empty">Log vacío o servicio no iniciado.</span>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={`log-line ${lineClass(line)}`}>{line || "\u00A0"}</div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </>
  );
}
