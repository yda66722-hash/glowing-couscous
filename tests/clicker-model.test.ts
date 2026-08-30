import { describe, expect, it } from "vitest";

import {
  clampCoordinate,
  createDefaultProfile,
  createShareCode,
  decodeShareCode,
  getPerformanceWarning,
  normalizePoints,
} from "../lib/clicker-model";

describe("clicker model", () => {
  it("creates a default profile with one numbered point", () => {
    const profile = createDefaultProfile();
    expect(profile.points).toHaveLength(1);
    expect(profile.points[0].id).toBe(1);
    expect(profile.intervalMs).toBe(500);
  });

  it("keeps point coordinates inside the safe canvas range", () => {
    expect(clampCoordinate(-1)).toBe(0.08);
    expect(clampCoordinate(2)).toBe(0.92);
    expect(normalizePoints([{ id: 7, x: 2, y: -1, intervalMs: 1, repeatCount: 0 }])).toEqual([
      { id: 1, x: 0.92, y: 0.08, intervalMs: 50, repeatCount: 1 },
    ]);
  });

  it("warns before an aggressive multi-point run", () => {
    const profile = createDefaultProfile();
    const points = [1, 2, 3, 4, 5].map((id) => ({ ...profile.points[0], id }));
    expect(getPerformanceWarning(points, 500, 30)?.level).toBe("amber");
    expect(getPerformanceWarning(points, 50, 30)?.level).toBe("red");
  });

  it("round-trips a share code without exposing a server dependency", () => {
    const profile = createDefaultProfile();
    const restored = decodeShareCode(createShareCode(profile));
    expect(restored?.name).toBe(profile.name);
    expect(restored?.points[0].id).toBe(1);
    expect(restored?.intervalMs).toBe(500);
    expect(decodeShareCode("invalid-code")).toBeNull();
  });
});
