import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import { normalizeChartContainerRect } from './chart-container-utils';

const EMPTY_SIZE = {
  width: 0,
  height: 0,
  ready: false,
};

export default function MeasuredChartFrame({
  className,
  minHeight = 280,
  fallback = null,
  children,
}) {
  const frameRef = useRef(null);
  const [size, setSize] = useState(EMPTY_SIZE);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;

    let rafId = 0;

    const updateSize = (rect = element.getBoundingClientRect()) => {
      const next = normalizeChartContainerRect(rect);
      setSize((current) => {
        if (
          current.width === next.width &&
          current.height === next.height &&
          current.ready === next.ready
        ) {
          return current;
        }

        return next;
      });
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        const firstEntry = entries[0];
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          updateSize(
            firstEntry?.contentRect || element.getBoundingClientRect(),
          );
        });
      });

      resizeObserver.observe(element);

      return () => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
      };
    }

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn('min-w-0', className)}
      style={{ minHeight }}
    >
      {size.ready ? children(size) : fallback}
    </div>
  );
}
