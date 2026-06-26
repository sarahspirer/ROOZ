import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  className?: string;
  format?: (v: number) => string;
  flashClass?: string;
}

export function AnimatedNumber({
  value,
  duration = 600,
  className,
  format = (v) => String(v),
  flashClass = 'text-compliance-green',
}: Props) {
  const [display, setDisplay] = useState(value);
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;

    const delta = value - prev;
    const goingUp = delta > 0;
    const start = performance.now();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), duration + 150);

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(prev + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
  }, [value, duration]);

  return (
    <span
      className={`${className ?? ''} transition-colors duration-300 ${flashing ? flashClass : ''}`}
      style={{ display: 'inline-block' }}
    >
      {format(display)}
    </span>
  );
}
