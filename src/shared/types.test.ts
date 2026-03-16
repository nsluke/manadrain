import { describe, it, expect } from "vitest";
import { makeCardId, formatMassEntry, CardEntry } from "./types";

describe("makeCardId", () => {
  it("creates id from name only", () => {
    expect(makeCardId("Lightning Bolt")).toBe("lightning bolt");
  });

  it("creates id from name + set + collector number", () => {
    expect(makeCardId("Lightning Bolt", "lea", "161")).toBe("lightning bolt__lea__161");
  });

  it("handles star collector numbers", () => {
    expect(makeCardId("Command Tower", "sld", "1496★")).toBe("command tower__sld__1496★");
  });

  it("trims and lowercases name", () => {
    expect(makeCardId("  Command Tower  ", "SLD", "1496")).toBe("command tower__sld__1496");
  });
});

function makeCard(overrides: Partial<CardEntry> & { name: string }): CardEntry {
  return {
    id: makeCardId(overrides.name, overrides.set, overrides.collectorNumber),
    quantity: 1,
    addedFrom: "test",
    addedAt: Date.now(),
    ...overrides,
  };
}

describe("formatMassEntry", () => {
  it("formats a basic card", () => {
    const cards = [makeCard({ name: "Lightning Bolt" })];
    expect(formatMassEntry(cards)).toBe("1 Lightning Bolt");
  });

  it("includes set and collector number", () => {
    const cards = [makeCard({ name: "Lightning Bolt", set: "lea", collectorNumber: "161" })];
    expect(formatMassEntry(cards)).toBe("1 Lightning Bolt [LEA] 161");
  });

  it("includes foil marker", () => {
    const cards = [makeCard({ name: "Lightning Bolt", set: "lea", collectorNumber: "161", foil: true })];
    expect(formatMassEntry(cards)).toBe("1 Lightning Bolt [LEA] 161 *F*");
  });

  it("strips star from collector numbers for mass entry", () => {
    const cards = [makeCard({ name: "Command Tower", set: "sld", collectorNumber: "1496★", foil: true })];
    expect(formatMassEntry(cards)).toBe("1 Command Tower [SLD] 1496 *F*");
  });

  it("keeps letter suffixes in collector numbers", () => {
    const cards = [makeCard({ name: "Some Card", set: "cmm", collectorNumber: "260a" })];
    expect(formatMassEntry(cards)).toBe("1 Some Card [CMM] 260a");
  });

  it("formats multiple cards", () => {
    const cards = [
      makeCard({ name: "Lightning Bolt", set: "lea", collectorNumber: "161", quantity: 4 }),
      makeCard({ name: "Command Tower", set: "sld", collectorNumber: "1496★" }),
    ];
    expect(formatMassEntry(cards)).toBe("4 Lightning Bolt [LEA] 161\n1 Command Tower [SLD] 1496");
  });
});
