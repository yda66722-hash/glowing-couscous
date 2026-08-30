import { describe, expect, it } from "vitest";

import {
  createFloatingMenuBounds,
  getMenuPanelPosition,
  snapToNearestEdge,
} from "../lib/floating-menu-utils";

describe("floating menu positioning", () => {
  it("creates an in-screen drag boundary with the configured safe margin", () => {
    expect(createFloatingMenuBounds(390, 720)).toEqual({
      minX: 16,
      maxX: 318,
      minY: 24,
      maxY: 648,
    });
  });

  it("snaps a floating ball to the nearest horizontal edge", () => {
    const bounds = createFloatingMenuBounds(390, 720);

    expect(snapToNearestEdge({ x: 60, y: 90 }, bounds)).toEqual({ x: 16, y: 90 });
    expect(snapToNearestEdge({ x: 240, y: 580 }, bounds)).toEqual({ x: 318, y: 580 });
  });

  it("keeps a menu panel fully inside the available screen area", () => {
    expect(getMenuPanelPosition({ x: 318, y: 648 }, 390, 720)).toEqual({ x: 118, y: 518 });
    expect(getMenuPanelPosition({ x: 16, y: 24 }, 390, 720)).toEqual({ x: 84, y: 24 });
  });
});
