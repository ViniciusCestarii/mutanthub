import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: true });

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "s",
    "del",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "input",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    code: ["class"],
    input: ["type", "checked", "disabled"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer", target: "_blank" }),
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
};

/** Renders untrusted Markdown to sanitized HTML. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
