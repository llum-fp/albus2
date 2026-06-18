import { useEffect, useRef, useState, useCallback } from "react";
import { Send, X, ChevronDown } from "./icons";
import type { ChatMsg } from "../useChat";
import Markdown from "./Markdown";

/* Vista del asistente Albus. Sin estado de red propio: el estado vive en useChat
   (en CourseViewer) para que el Quiz pueda dirigir la conversación. */
export default function ChatPanel({
  messages,
  streaming,
  onSend,
  canClose,
  onClose,
  notice,
  needsReply,
  wrongFlashKey,
  onResize,
}: {
  messages: ChatMsg[];
  streaming: boolean;
  onSend: (text: string) => void;
  canClose: boolean;
  onClose: () => void;
  notice?: string;
  needsReply?: boolean;
  wrongFlashKey?: number;
  onResize?: (px: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  // ¿Está el chat pegado al fondo? (con margen para no exigir el píxel exacto)
  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < 80;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Solo auto-scrollea si el usuario ya estaba al fondo; si subió a leer, se respeta.
  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages, atBottom, scrollToBottom]);

  const onBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (el) setAtBottom(isNearBottom(el));
  }, []);

  useEffect(() => {
    if (!wrongFlashKey) return;
    setFlashing(true);
  }, [wrongFlashKey]);

  const stopFlash = useCallback(() => setFlashing(false), []);

  // Redimensionado arrastrando el borde izquierdo del chat.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.max(300, Math.min(window.innerWidth * 0.6, window.innerWidth - e.clientX));
      onResize?.(w);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, onResize]);

  const send = () => {
    const t = draft.trim();
    if (!t || streaming) return;
    setDraft("");
    onSend(t);
  };

  return (
    <aside className="chat">
      {flashing && <div key={wrongFlashKey} className="chat-flash-overlay" onAnimationEnd={stopFlash} />}
      {onResize && (
        <div
          className={`chat-resizer ${dragging ? "active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          title="Drag to widen the chat"
        />
      )}
      <div className={`chat-header${needsReply ? " chat-header--needs-reply" : ""}`}>
        <span className="chat-title">
          <img src="/dumbly.svg" alt="" aria-hidden="true" className="chat-avatar" /> Albus
        </span>
        {canClose && (
          <button className="icon-btn" onClick={onClose} title="Close chat">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="chat-body" ref={bodyRef} onScroll={onBodyScroll}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from} ${m.error ? "error" : ""}`}>
            {m.from === "bot" && m.text ? <Markdown text={m.text} /> : m.text}
            {m.streaming && !m.text && (
              <span className="typing">
                <span />
                <span />
                <span />
              </span>
            )}
            {m.streaming && m.text && <span className="caret" />}
          </div>
        ))}
        {notice && <div className="chat-notice">{notice}</div>}
      </div>

      {!atBottom && (
        <button
          className={`chat-scroll-down${streaming ? " streaming" : ""}`}
          onClick={() => scrollToBottom()}
          title="Scroll to latest"
        >
          <ChevronDown size={18} />
        </button>
      )}

      <div className="chat-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={streaming ? "Albus is typing…" : "Type your question…"}
          disabled={streaming}
        />
        <button
          className="icon-btn send"
          onClick={send}
          title="Send"
          disabled={streaming || !draft.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </aside>
  );
}
