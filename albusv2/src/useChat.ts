import { useRef, useState } from "react";
import {
  createChatSession,
  chatStreamUrl,
  type QuizPhase,
  type ChatStreamOpts,
} from "./api";

export interface ChatMsg {
  from: "bot" | "user";
  text: string;
  streaming?: boolean;
  error?: boolean;
}

/* Estado y lógica del chat de Albus, compartido entre el ChatPanel (vista + input
   del usuario) y el Quiz (que dispara eventos programáticos y espera a que terminen). */
export function useChat(courseId: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      from: "bot",
      text: "Hi 👋 I'm Albus, your tutor. Ask me anything about this course.",
    },
  ]);
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const patchLastBot = (patch: Partial<ChatMsg>) =>
    setMessages((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].from === "bot") {
          copy[i] = { ...copy[i], ...patch };
          break;
        }
      }
      return copy;
    });

  // Lanza un turno de stream y resuelve cuando Albus termina (evento done) o falla.
  const runStream = (
    opts: Omit<ChatStreamOpts, "courseId" | "sessionId">,
    userBubble?: string,
  ): Promise<void> =>
    new Promise(async (resolve) => {
      if (streaming) return resolve();
      setStreaming(true);
      setMessages((m) => [
        ...m,
        ...(userBubble ? ([{ from: "user", text: userBubble }] as ChatMsg[]) : []),
        { from: "bot", text: "", streaming: true },
      ]);

      const finish = () => {
        esRef.current?.close();
        esRef.current = null;
        setStreaming(false);
        resolve();
      };

      try {
        if (sessionRef.current == null) sessionRef.current = await createChatSession();
        const es = new EventSource(
          chatStreamUrl({ ...opts, courseId, sessionId: sessionRef.current }),
        );
        esRef.current = es;
        let collected = "";

        es.addEventListener("token", (e) => {
          try {
            const d = JSON.parse((e as MessageEvent).data);
            if (typeof d.delta === "string") {
              collected += d.delta;
              patchLastBot({ text: collected });
            }
          } catch {}
        });
        es.addEventListener("done", () => {
          patchLastBot({ streaming: false });
          finish();
        });
        es.addEventListener("error", (e) => {
          let msg = "Could not connect to Albus.";
          try {
            const d = JSON.parse((e as MessageEvent).data);
            if (d.message) msg = d.message;
          } catch {}
          patchLastBot({ text: collected || msg, streaming: false, error: !collected });
          finish();
        });
      } catch {
        patchLastBot({ text: "Could not start the conversation with Albus.", streaming: false, error: true });
        finish();
      }
    });

  // Mensaje libre del usuario (muestra burbuja de usuario).
  const sendUser = (text: string, lessonId?: string) =>
    runStream({ message: text, lessonId }, text);

  // Evento de quiz. En "wrong_explain" la razón del alumno se muestra como burbuja.
  const sendQuiz = (args: {
    phase: QuizPhase;
    questionId: string;
    chosenIndex: number;
    lessonId?: string;
    userText?: string;
  }) =>
    runStream(
      {
        quizPhase: args.phase,
        questionId: args.questionId,
        chosenIndex: args.chosenIndex,
        lessonId: args.lessonId,
        message: args.userText,
      },
      args.phase === "wrong_explain" ? args.userText : undefined,
    );

  return { messages, streaming, sendUser, sendQuiz };
}
