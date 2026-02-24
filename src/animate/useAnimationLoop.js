import { useEffect, useRef } from 'react';

/**
 * RAF animation loop hook.
 * Calls onFrame(t) every frame where t = elapsed seconds since first frame.
 * Cleans up on unmount or when onFrame reference changes.
 */
export function useAnimationLoop(onFrame) {
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const onFrameRef = useRef(onFrame);

  // Keep the callback ref up-to-date without restarting the loop
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    startRef.current = null;

    function tick(timestamp) {
      if (startRef.current === null) startRef.current = timestamp;
      const t = (timestamp - startRef.current) / 1000; // seconds
      onFrameRef.current(t);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []); // only run once on mount
}
