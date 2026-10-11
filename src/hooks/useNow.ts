import { useEffect, useState } from 'react';

/** Current time, refreshed on an interval while `active`. Keep it in leaf components only. */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const h = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(h);
  }, [intervalMs, active]);
  return now;
}
