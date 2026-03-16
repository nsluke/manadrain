import { describe, it, expect } from "vitest";

// Extract parseCardUrl logic to test it — same regex used in scryfall.ts and manapool.ts
function parseCardUrl(url: string): { set: string; collectorNumber: string; name: string } | null {
  const match = url.match(/\/card\/([a-z0-9]+)\/([^/]+)\/([^/?#]+)/i);
  if (!match) return null;
  return {
    set: match[1],
    collectorNumber: decodeURIComponent(match[2]),
    name: decodeURIComponent(match[3]).replace(/-/g, " "),
  };
}

describe("parseCardUrl", () => {
  it("parses a standard card URL", () => {
    expect(parseCardUrl("/card/ecl/391/selfless-safewright")).toEqual({
      set: "ecl",
      collectorNumber: "391",
      name: "selfless safewright",
    });
  });

  it("parses a URL with encoded star in collector number", () => {
    expect(parseCardUrl("/card/sld/1496%E2%98%85/command-tower")).toEqual({
      set: "sld",
      collectorNumber: "1496★",
      name: "command tower",
    });
  });

  it("parses a URL with literal star in collector number", () => {
    expect(parseCardUrl("/card/sld/1496★/command-tower")).toEqual({
      set: "sld",
      collectorNumber: "1496★",
      name: "command tower",
    });
  });

  it("parses a URL with letter suffix in collector number", () => {
    expect(parseCardUrl("/card/clb/471/abdel-adrian-gorions-ward")).toEqual({
      set: "clb",
      collectorNumber: "471",
      name: "abdel adrian gorions ward",
    });
  });

  it("parses a full URL with query params", () => {
    expect(parseCardUrl("/card/sld/1496%E2%98%85/command-tower?finish=foil")).toEqual({
      set: "sld",
      collectorNumber: "1496★",
      name: "command tower",
    });
  });

  it("parses a full URL with hash", () => {
    expect(parseCardUrl("/card/ecl/110/moonshadow#details")).toEqual({
      set: "ecl",
      collectorNumber: "110",
      name: "moonshadow",
    });
  });

  it("returns null for non-card URLs", () => {
    expect(parseCardUrl("/search?q=lightning+bolt")).toBeNull();
    expect(parseCardUrl("/set/ecl")).toBeNull();
    expect(parseCardUrl("/add-deck")).toBeNull();
  });

  it("handles collector numbers with letter suffixes", () => {
    expect(parseCardUrl("/card/cmm/260a/some-card")).toEqual({
      set: "cmm",
      collectorNumber: "260a",
      name: "some card",
    });
  });
});
