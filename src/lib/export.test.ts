import { describe, expect, it } from "vitest";
import { SVG_THEMES, baseName, readmeFile, readmeSnippet, toMarkdown, toSvg } from "./export";
import { validateFile } from "./image";

describe("toMarkdown", () => {
  it("wraps art in a code fence, preserving whitespace", () => {
    expect(toMarkdown("  @@\n @  ")).toBe("```text\n  @@\n @  \n```\n");
  });
  it("uses a longer fence when the art contains backticks", () => {
    expect(toMarkdown("a```b").startsWith("````text\n")).toBe(true);
  });
});

describe("toSvg", () => {
  const svg = toSvg("<@ &\n  ##", SVG_THEMES.dark);
  it("has a solid background and escapes text", () => {
    expect(svg).toContain(`fill="${SVG_THEMES.dark.background}"`);
    expect(svg).toContain("&lt;@ &amp;");
    expect(svg).not.toMatch(/<@/);
  });
  it("renders one aligned text row per line with preserved spaces", () => {
    expect(svg.match(/<text /g)).toHaveLength(2);
    expect(svg).toContain(">  ##</text>");
    expect(svg).toMatch(/textLength="28.8"/); // 4 chars × 7.2px
  });
});

describe("validateFile", () => {
  it("accepts supported images", () => {
    expect(validateFile({ name: "me.JPG", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateFile({ name: "me.webp", type: "", size: 1000 })).toBeNull();
  });
  it("rejects other types and oversized files", () => {
    expect(validateFile({ name: "me.gif", type: "image/gif", size: 1000 })).toMatch(/isn't supported/);
    expect(validateFile({ name: "me.png", type: "image/png", size: 40 * 1024 * 1024 })).toMatch(/limit/);
    expect(validateFile({ name: "me.png", type: "image/png", size: 0 })).toMatch(/empty/);
  });
});

describe("baseName", () => {
  it("slugifies file names", () => {
    expect(baseName("My Selfie (1).JPG")).toBe("my-selfie-1");
    expect(baseName(".png")).toBe("portrait");
  });
});

describe("animated SVG", () => {
  const art = "ab\ncd\nef";
  const anim = (loop: boolean) => toSvg(art, SVG_THEMES.dark, 12, { lineMs: 100, loop, accent: "#a78bfa" });

  it("reveals lines top to bottom with matching values and keyTimes", () => {
    const svg = anim(true);
    const reveal = svg.match(/attributeName="height" values="([^"]+)"[^>]*keyTimes="([^"]+)"/)!;
    const values = reveal[1].split(";").map(Number);
    const times = reveal[2].split(";").map(Number);
    expect(values).toHaveLength(times.length);
    expect(values[0]).toBe(0);
    expect([...values].sort((a, b) => a - b)).toEqual(values); // only ever grows
    expect(times[0]).toBe(0);
    expect(svg).toContain('repeatCount="indefinite"');
    expect(svg).toContain('clip-path="url(#reveal)"');
  });

  it("draws once and freezes when not looping", () => {
    const svg = anim(false);
    expect(svg).toContain('repeatCount="1"');
    expect(svg).toContain('fill="freeze"');
    expect(svg).toContain('dur="400ms"'); // (3 lines + 1) × 100ms
  });

  it("static export has no animation", () => {
    expect(toSvg(art, SVG_THEMES.dark)).not.toContain("<animate");
  });

  it("builds a README snippet pointing at the file", () => {
    expect(readmeSnippet("me-ascii-animated.svg")).toContain('src="./me-ascii-animated.svg"');
  });
});

describe("readmeFile", () => {
  it("adds an escaped greeting and tagline only when provided", () => {
    expect(readmeFile("a.svg")).toBe(readmeSnippet("a.svg"));
    const out = readmeFile("a.svg", { name: " Ada <L> ", tagline: "Hi & bye" });
    expect(out).toContain("Hi, I’m Ada &lt;L&gt;</h1>");
    expect(out).toContain("<p align=\"center\">Hi &amp; bye</p>");
  });
});
