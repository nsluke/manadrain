import { describe, it, expect, beforeEach } from "vitest";
import { markAdded, clearMark, isRecentlyAdded, resetAll, CHECKMARK_DURATION } from "./checkmark-state";

beforeEach(() => {
  resetAll();
});

describe("checkmark-state", () => {
  it("returns false for unmarked keys", () => {
    expect(isRecentlyAdded("0")).toBe(false);
    expect(isRecentlyAdded("5")).toBe(false);
  });

  it("returns true immediately after marking", () => {
    const now = 1000000;
    markAdded("0", now);
    expect(isRecentlyAdded("0", now)).toBe(true);
    expect(isRecentlyAdded("0", now + 100)).toBe(true);
  });

  it("returns true within the checkmark duration", () => {
    const now = 1000000;
    markAdded("0", now);
    expect(isRecentlyAdded("0", now + CHECKMARK_DURATION - 1)).toBe(true);
  });

  it("returns false after the checkmark duration expires", () => {
    const now = 1000000;
    markAdded("0", now);
    expect(isRecentlyAdded("0", now + CHECKMARK_DURATION)).toBe(false);
    expect(isRecentlyAdded("0", now + CHECKMARK_DURATION + 100)).toBe(false);
  });

  it("tracks multiple keys independently", () => {
    const now = 1000000;
    markAdded("0", now);
    markAdded("3", now + 500);

    // Key 0 marked at 1000000, key 3 marked at 1000500
    // At now + 1100: key 0 is 1100ms old (expired), key 3 is 600ms old (still valid)
    expect(isRecentlyAdded("0", now + CHECKMARK_DURATION)).toBe(false);
    expect(isRecentlyAdded("3", now + CHECKMARK_DURATION)).toBe(true);
  });

  it("clearMark removes the entry", () => {
    const now = 1000000;
    markAdded("0", now);
    expect(isRecentlyAdded("0", now)).toBe(true);

    clearMark("0");
    expect(isRecentlyAdded("0", now)).toBe(false);
  });

  it("resetAll clears everything", () => {
    const now = 1000000;
    markAdded("0", now);
    markAdded("1", now);
    markAdded("2", now);

    resetAll();

    expect(isRecentlyAdded("0", now)).toBe(false);
    expect(isRecentlyAdded("1", now)).toBe(false);
    expect(isRecentlyAdded("2", now)).toBe(false);
  });

  it("re-marking updates the timestamp", () => {
    const now = 1000000;
    markAdded("0", now);

    // Re-mark later
    markAdded("0", now + 1000);

    // Original timestamp would have expired, but re-mark extends it
    expect(isRecentlyAdded("0", now + CHECKMARK_DURATION + 500)).toBe(true);
  });

  it("simulates BotBox re-render: button destroyed and recreated preserves state", () => {
    const now = 1000000;

    // User clicks card at index 2
    markAdded("2", now);

    // 200ms later, BotBox re-renders — our code checks state when creating new button
    expect(isRecentlyAdded("2", now + 200)).toBe(true);
    // Button at index 0 was not clicked
    expect(isRecentlyAdded("0", now + 200)).toBe(false);

    // 1300ms later, checkmark should have expired
    expect(isRecentlyAdded("2", now + CHECKMARK_DURATION + 100)).toBe(false);
  });
});
