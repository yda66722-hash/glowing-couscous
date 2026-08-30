export const FLOATING_BALL_SIZE = 56;
export const FLOATING_MARGIN = 16;
export const MENU_PANEL_WIDTH = 188;
export const MENU_PANEL_HEIGHT = 186;

export type FloatingMenuBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type FloatingPosition = {
  x: number;
  y: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function createFloatingMenuBounds(width: number, height: number): FloatingMenuBounds {
  return {
    minX: FLOATING_MARGIN,
    maxX: Math.max(FLOATING_MARGIN, width - FLOATING_BALL_SIZE - FLOATING_MARGIN),
    minY: FLOATING_MARGIN + 8,
    maxY: Math.max(FLOATING_MARGIN + 8, height - FLOATING_BALL_SIZE - FLOATING_MARGIN),
  };
}

export function snapToNearestEdge(position: FloatingPosition, bounds: FloatingMenuBounds): FloatingPosition {
  const center = (bounds.minX + bounds.maxX) / 2;
  return {
    x: position.x + FLOATING_BALL_SIZE / 2 < center ? bounds.minX : bounds.maxX,
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function getMenuPanelPosition(
  position: FloatingPosition,
  containerWidth: number,
  containerHeight: number,
): FloatingPosition {
  const isOnLeft = position.x + FLOATING_BALL_SIZE / 2 < containerWidth / 2;
  const preferredX = isOnLeft
    ? position.x + FLOATING_BALL_SIZE + 12
    : position.x - MENU_PANEL_WIDTH - 12;
  const preferredY = position.y - MENU_PANEL_HEIGHT + FLOATING_BALL_SIZE;

  return {
    x: clamp(preferredX, FLOATING_MARGIN, Math.max(FLOATING_MARGIN, containerWidth - MENU_PANEL_WIDTH - FLOATING_MARGIN)),
    y: clamp(preferredY, FLOATING_MARGIN + 8, Math.max(FLOATING_MARGIN + 8, containerHeight - MENU_PANEL_HEIGHT - FLOATING_MARGIN)),
  };
}
