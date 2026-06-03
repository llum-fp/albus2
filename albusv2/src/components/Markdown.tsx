import { Fragment, type ReactNode } from "react";

/* Renderer de Markdown ligero (sin dependencias) pensado para las respuestas de
   Albus. Cubre el subconjunto que el modelo usa de verdad: encabezados, listas
   (con viñeta y numeradas), bloques y spans de código, negrita, cursiva y
   enlaces. Es tolerante con texto a medias (streaming): si un marcador queda sin
   cerrar, se muestra tal cual sin romper nada. */

// ---- Inline: **negrita**, *cursiva*/_cursiva_, `código`, [texto](url) --------

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;

  // Patrón que captura el primer marcador inline que aparezca. El último grupo
  // es una URL "pelada" (red de seguridad para que siempre sea clickable).
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+)/;

  while (rest) {
    const m = pattern.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;

    if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>);
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    } else if (tok.startsWith("[")) {
      // enlace [texto](url)
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (lm) {
        out.push(
          <a key={key} href={lm[2]} target="_blank" rel="noopener noreferrer">
            {lm[1]}
          </a>,
        );
      } else {
        out.push(tok);
      }
    } else {
      // URL pelada -> hipervínculo (texto = la propia URL, sin la barra final)
      const url = tok.replace(/[.,;:]+$/, "");
      out.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>,
      );
      if (url.length < tok.length) out.push(tok.slice(url.length));
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

// ---- Bloques: párrafos, encabezados, listas, code fences --------------------

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence ```
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // saltar el cierre
      blocks.push(
        <pre key={key++}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Línea en blanco -> separador
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Encabezado #..###### (mapeado a h3..h6 para no romper la escala visual)
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const inner = renderInline(h[2], `h${key}`);
      const lvl = Math.min(h[1].length + 2, 6);
      blocks.push(
        lvl <= 3 ? (
          <h3 key={key++}>{inner}</h3>
        ) : lvl === 4 ? (
          <h4 key={key++}>{inner}</h4>
        ) : lvl === 5 ? (
          <h5 key={key++}>{inner}</h5>
        ) : (
          <h6 key={key++}>{inner}</h6>
        ),
      );
      i++;
      continue;
    }

    // Lista no ordenada
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*+]\s+/, "");
        items.push(<li key={items.length}>{renderInline(content, `ul${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }

    // Lista ordenada
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+[.)]\s+/, "");
        items.push(<li key={items.length}>{renderInline(content, `ol${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }

    // Párrafo: agrupar líneas contiguas no vacías, con saltos suaves
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((l, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(l, `p${key}-${idx}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <>{blocks}</>;
}
