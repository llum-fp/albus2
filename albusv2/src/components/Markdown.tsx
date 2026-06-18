import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* Renderer de Markdown para las respuestas de Albus. Usa react-markdown +
   remark-gfm (GFM completo: tablas, citas, tachado, listas de tareas, hr,
   etc.), igual que el visor de lecciones. Tolerante con texto a medias durante
   el streaming. Los enlaces se abren en pestaña nueva. La tabla se envuelve
   para permitir scroll horizontal en burbujas estrechas. */

export default function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        table: ({ node: _node, ...props }) => (
          <div className="md-table-wrap">
            <table className="md-table" {...props} />
          </div>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
