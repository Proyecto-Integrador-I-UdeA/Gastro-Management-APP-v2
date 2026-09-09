export type KitchenTimerState = "normal" | "warning" | "overdue";

export type KitchenTimer = {
  state: KitchenTimerState;
  label: string;
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getKitchenTimer(
  targetReadyAt: string,
  warningThresholdMinutes: number,
  nowMs: number,
): KitchenTimer {
  const remainingMs = new Date(targetReadyAt).getTime() - nowMs;
  if (remainingMs <= 0) {
    return {
      state: "overdue",
      label: `Retraso ${formatClock(Math.floor(Math.abs(remainingMs) / 1000))}`,
    };
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return {
    state: remainingSeconds <= warningThresholdMinutes * 60 ? "warning" : "normal",
    label: formatClock(remainingSeconds),
  };
}
