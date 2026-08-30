export const MIN_CLICK_INTERVAL = 100;
export const MAX_CLICK_INTERVAL = 10_000;
export const MIN_CLICK_COUNT = 1;
export const MAX_CLICK_COUNT = 99_999;

export type ClickerStatus = "idle" | "running" | "paused" | "complete";

export function normalizeClickInterval(value: number) {
  return Math.min(MAX_CLICK_INTERVAL, Math.max(MIN_CLICK_INTERVAL, Math.round(value / 50) * 50));
}

export function normalizeClickCount(value: number) {
  return Math.min(MAX_CLICK_COUNT, Math.max(MIN_CLICK_COUNT, Math.round(value)));
}

export function getClickProgress(completedCount: number, targetCount: number) {
  if (targetCount <= 0) return 0;
  return Math.min(1, Math.max(0, completedCount / targetCount));
}

export function getClickerStatusLabel(status: ClickerStatus) {
  switch (status) {
    case "running":
      return "连点中";
    case "paused":
      return "已暂停";
    case "complete":
      return "已完成";
    default:
      return "待机中";
  }
}
