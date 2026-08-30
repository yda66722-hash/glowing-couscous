import { describe, expect, it } from "vitest";

import {
  getClickProgress,
  getClickerStatusLabel,
  MAX_CLICK_COUNT,
  MAX_CLICK_INTERVAL,
  MIN_CLICK_COUNT,
  MIN_CLICK_INTERVAL,
  normalizeClickCount,
  normalizeClickInterval,
} from "../lib/clicker-utils";

describe("clicker utilities", () => {
  it("clamps the interval to the supported range and 50ms steps", () => {
    expect(normalizeClickInterval(10)).toBe(MIN_CLICK_INTERVAL);
    expect(normalizeClickInterval(476)).toBe(500);
    expect(normalizeClickInterval(99_999)).toBe(MAX_CLICK_INTERVAL);
  });

  it("clamps the target count to a positive integer range", () => {
    expect(normalizeClickCount(0)).toBe(MIN_CLICK_COUNT);
    expect(normalizeClickCount(12.6)).toBe(13);
    expect(normalizeClickCount(100_000)).toBe(MAX_CLICK_COUNT);
  });

  it("keeps progress between zero and one", () => {
    expect(getClickProgress(0, 20)).toBe(0);
    expect(getClickProgress(10, 20)).toBe(0.5);
    expect(getClickProgress(30, 20)).toBe(1);
    expect(getClickProgress(-1, 20)).toBe(0);
  });

  it("returns readable status labels", () => {
    expect(getClickerStatusLabel("idle")).toBe("待机中");
    expect(getClickerStatusLabel("running")).toBe("连点中");
    expect(getClickerStatusLabel("paused")).toBe("已暂停");
    expect(getClickerStatusLabel("complete")).toBe("已完成");
  });
});
