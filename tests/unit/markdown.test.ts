import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdown("**bold** and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
  });

  it("strips scripts and event handlers", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("forces safe link attributes", () => {
    const html = renderMarkdown("[site](https://example.com)");
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});
