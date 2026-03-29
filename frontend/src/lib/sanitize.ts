/**
 * HTML-Sanitization mit DOMPurify.
 *
 * Alle Stellen, die dangerouslySetInnerHTML verwenden,
 * MUESSEN den HTML-String vorher durch sanitizeHtml() leiten.
 */
import DOMPurify from "dompurify";

/**
 * Bereinigt HTML-Strings und entfernt potenziell gefaehrliche Inhalte.
 * Erlaubt nur sichere HTML-Tags und Attribute.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") {
    // Server-side: Einfache Tag-Entfernung als Fallback
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "a", "span", "div",
      "table", "thead", "tbody", "tr", "th", "td",
      "blockquote", "pre", "code",
      "hr", "sub", "sup",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "class", "style",
      "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
