import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

/** Known XSS payloads must never survive the Markdown sanitizer. */
const PAYLOADS: Array<[string, string]> = [
  ["script tag", "<script>alert(1)</script>"],
  ["svg onload", '<svg onload="alert(1)"><circle r="1"/></svg>'],
  ["img onerror", "<img src=x onerror=alert(1)>"],
  ["iframe", '<iframe src="https://evil.example"></iframe>'],
  ["object/embed", '<object data="x"></object><embed src="x">'],
  ["javascript href", '<a href="javascript:alert(1)">x</a>'],
  ["javascript href with whitespace", '<a href="  java\nscript:alert(1)">x</a>'],
  ["data href", '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
  ["markdown javascript link", "[x](javascript:alert(1))"],
  ["style attribute", '<p style="background:url(javascript:alert(1))">x</p>'],
  ["form", '<form action="https://evil.example"><input name=a></form>'],
  ["meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
  ["event handler on allowed tag", '<p onclick="alert(1)">x</p>'],
  ["nested encoding", "<scr<script>ipt>alert(1)</script>"],
  ["math/mglyph", "<math><mglyph onload=alert(1)></math>"],
];

describe("markdown sanitizer hardening", () => {
  for (const [name, payload] of PAYLOADS) {
    it(`neutralises ${name}`, () => {
      const html = renderMarkdown(payload).toLowerCase();
      expect(html).not.toMatch(/<script/);
      expect(html).not.toMatch(/on[a-z]+\s*=/);
      expect(html).not.toMatch(/javascript:/);
      expect(html).not.toMatch(/<(iframe|object|embed|form|meta|svg|math)/);
      expect(html).not.toMatch(/style=/);
      expect(html).not.toMatch(/href="data:/);
    });
  }

  it("keeps useful content: code blocks, links, task lists", () => {
    const html = renderMarkdown(
      "```c\nif (a > b) {}\n```\n\n- [x] done\n\n[docs](https://example.com/a?b=1)",
    );
    expect(html).toContain('<code class="language-c">');
    expect(html).toContain("&gt;");
    expect(html).toContain('href="https://example.com/a?b=1"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });
});
