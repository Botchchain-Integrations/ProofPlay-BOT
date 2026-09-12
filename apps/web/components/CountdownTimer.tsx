"use client";

import { useEffect, useState } from "react";

function getTimeLeft(target: number) {
  const diff = target - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  if (hours > 0) return { hours, minutes, seconds, totalMs: diff };
  if (minutes > 0) return { hours: 0, minutes, seconds, totalMs: diff };
  return { hours: 0, minutes: 0, seconds, totalMs: diff };
}

export function CountdownTimer({ targetDate }: { targetDate: string }) {
  const target = new Date(targetDate).getTime();
  const [display, setDisplay] = useState(() => getTimeLeft(target));

  useEffect(() => {
    setDisplay(getTimeLeft(target));
    const interval = setInterval(() => {
      const next = getTimeLeft(target);
      setDisplay(next);
      if (!next) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!display) {
    return <span style={{ color: "var(--green)", fontWeight: 500 }}>Started</span>;
  }

  if (display.hours > 0) {
    return (
      <span className="mono" style={{ color: "var(--zinc-400)" }}>
        {display.hours}h {display.minutes}m
      </span>
    );
  }

  if (display.minutes > 0) {
    return (
      <span className="mono" style={{ color: "rgba(245, 158, 11, 0.85)" }}>
        {display.minutes}m {display.seconds}s
      </span>
    );
  }

  return (
    <span className="mono" style={{ color: "var(--red)", animation: "pulse 1.4s ease-in-out infinite" }}>
      {display.seconds}s
    </span>
  );
}