export function useHapticFeedback() {
  const vibrate = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  };
  return {
    pickup: () => vibrate(8),
    drop: () => vibrate([4, 30, 6]),
    cancel: () => vibrate(12),
  };
}
