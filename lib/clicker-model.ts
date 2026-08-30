export type ClickPoint = {
  id: number;
  x: number;
  y: number;
  intervalMs: number;
  repeatCount: number;
};

export type ClickerProfile = {
  name: string;
  points: ClickPoint[];
  intervalMs: number;
  cycleCount: number;
  createdAt: string;
};

export type PerformanceWarning = {
  level: "amber" | "red";
  message: string;
} | null;

export const MAX_POINTS = 9;
export const MIN_INTERVAL_MS = 50;
export const MAX_INTERVAL_MS = 10000;
export const MIN_REPEAT_COUNT = 1;
export const MAX_REPEAT_COUNT = 9999;
export const MIN_CYCLE_COUNT = 1;
export const MAX_CYCLE_COUNT = 9999;

export function createPoint(id: number, index = 0): ClickPoint {
  const positions = [
    { x: 0.24, y: 0.32 },
    { x: 0.52, y: 0.42 },
    { x: 0.76, y: 0.58 },
    { x: 0.34, y: 0.68 },
    { x: 0.68, y: 0.26 },
  ];
  const position = positions[index % positions.length];
  return { id, x: position.x, y: position.y, intervalMs: 500, repeatCount: 1 };
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}

export function clampCoordinate(value: number) {
  return Math.min(Math.max(value, 0.08), 0.92);
}

export function normalizePoints(points: ClickPoint[]) {
  return points.map((point, index) => ({
    ...point,
    id: index + 1,
    x: clampCoordinate(point.x),
    y: clampCoordinate(point.y),
    intervalMs: clampNumber(point.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS),
    repeatCount: clampNumber(point.repeatCount, MIN_REPEAT_COUNT, MAX_REPEAT_COUNT),
  }));
}

export function getPerformanceWarning(
  points: ClickPoint[],
  globalIntervalMs: number,
  cycleCount: number,
): PerformanceWarning {
  const estimatedClicksPerSecond = points.length * (1000 / Math.max(globalIntervalMs, 1));
  if (globalIntervalMs < 80 || estimatedClicksPerSecond > 80) {
    return {
      level: "red",
      message: "当前点击频率非常高，部分设备可能卡顿、发热或耗电增加。建议把间隔调到 100ms 以上。",
    };
  }
  if (points.length >= 5 || cycleCount >= 1000 || estimatedClicksPerSecond > 35) {
    return {
      level: "amber",
      message: "当前方案的点击量较大，运行时可能出现短暂卡顿；建议先用较少点位测试。",
    };
  }
  return null;
}

function randomAlphaNumeric(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function createShareCode(profile: ClickerProfile) {
  const payload = encodeURIComponent(JSON.stringify(profile));
  return `YUT-${randomAlphaNumeric(4)}-${payload}`;
}

export function decodeShareCode(code: string): ClickerProfile | null {
  const marker = code.indexOf("-");
  const secondMarker = code.indexOf("-", marker + 1);
  if (marker < 1 || secondMarker < marker || !code.startsWith("YUT-")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(code.slice(secondMarker + 1))) as Partial<ClickerProfile>;
    if (!parsed || !Array.isArray(parsed.points) || parsed.points.length === 0) return null;
    const points = normalizePoints(parsed.points as ClickPoint[]);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "导入方案",
      points,
      intervalMs: clampNumber(Number(parsed.intervalMs) || 500, MIN_INTERVAL_MS, MAX_INTERVAL_MS),
      cycleCount: clampNumber(Number(parsed.cycleCount) || 1, MIN_CYCLE_COUNT, MAX_CYCLE_COUNT),
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function createDefaultProfile(): ClickerProfile {
  return {
    name: "我的连点方案",
    points: [createPoint(1)],
    intervalMs: 500,
    cycleCount: 30,
    createdAt: new Date().toISOString(),
  };
}
