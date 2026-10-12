/**
 * Tiny, safe markdown renderer for staff-written catalog descriptions (build time).
 *
 * Everything is HTML-escaped first, so raw HTML in the catalog can never reach the page. Supported:
 * paragraphs, "-" / "*" bullet lists, "1." numbered lists, "#" headings (demoted below the page's
 * own h2, so "#"/"##" become h3 and deeper become h4), **bold**, *italic* / _italic_, and
 * [links](url) for http(s), mailto:, tel: and site-relative "/" URLs only. Anything else stays text.
 */

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

const SAFE_URL = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d][\d\s-]*|\/(?!\/)[^\s]*)$/i;

function emphasis(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, "$1<em>$2</em>");
}

function inline(raw: string): string {
  const s = escapeHtml(raw.trim().replace(/\u0000/g, ""));
  // Links first, swapped for placeholders so the emphasis rules never touch a URL ("/a_b_c", "*").
  // The URL was escaped above, so it cannot break out of the attribute.
  const links: string[] = [];
  const withTokens = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    const decoded = url.replace(/&amp;/g, "&");
    if (!SAFE_URL.test(decoded)) return label;
    const external = /^https?:\/\//i.test(decoded);
    links.push(`<a href="${url}"${external ? ' target="_blank" rel="nofollow noopener noreferrer"' : ""}>${emphasis(label)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  return emphasis(withTokens).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)] ?? "");
}

/** Render staff markdown to trusted HTML for <Prose html={...} />. Empty input returns "". */
export function renderCatalogMarkdown(markdown: string): string {
  const blocks = markdown
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      const heading = /^(#{1,6})\s+(.+)$/.exec(lines[0] ?? "");
      if (heading && lines.length === 1) {
        const level = heading[1].length <= 2 ? 3 : 4;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
      }
      return `<p>${lines.map(inline).join(" ")}</p>`;
    })
    .join("\n");
}
