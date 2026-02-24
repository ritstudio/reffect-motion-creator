import { forwardRef, useRef, useEffect, useCallback } from 'react';
import { useAnimationLoop } from './useAnimationLoop.js';

/**
 * Fixed-resolution animated canvas.
 *
 * Always renders at outputWidth × outputHeight (same fixed coordinate space
 * as the static SVG generator).  The canvas CSS display size is fitted to the
 * container via ResizeObserver, so the rendered content scales like an SVG
 * viewBox — switching between 1-col and 2-col grid never changes the visuals.
 *
 * Props:
 *   sampleData   — brightness grid from svg-sampler
 *   effectModule — { init, drawFrame, getDefaultParams, getParamSchema }
 *   aspect       — width / height ratio of the source SVG (e.g. 4.86 for FILMER)
 *   params       — optional param overrides
 *   outputWidth  — fixed logical render width  (default 1000)
 *   outputHeight — fixed logical render height (default outputWidth / aspect)
 */
const AnimatedCanvas = forwardRef(function AnimatedCanvas(
  { sampleData, effectModule, aspect = 1, params = {}, outputWidth = 1000, outputHeight },
  externalRef,
) {
  const internalCanvasRef = useRef(null);
  const canvasRef    = externalRef ?? internalCanvasRef;
  const wrapperRef   = useRef(null);
  const animStateRef = useRef(null);
  const ctxRef       = useRef(null);
  const sizeRef      = useRef({ w: 0, h: 0 }); // CSS display size (container-derived)

  // Fixed logical render height — derived from aspect if not explicitly provided
  const fixedH = outputHeight ?? Math.max(1, Math.round(outputWidth / aspect));

  // ── Initialise / Re-initialise the effect at the fixed logical resolution ──
  const initEffect = useCallback(
    () => {
      if (!sampleData || !effectModule) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;

      // Canvas buffer: always the fixed logical resolution
      canvas.width  = Math.round(outputWidth * dpr);
      canvas.height = Math.round(fixedH * dpr);

      // CSS display size: container size from ResizeObserver (if already known)
      const { w, h } = sizeRef.current;
      if (w > 0) {
        canvas.style.width  = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctxRef.current = ctx;

      const mergedParams = { ...effectModule.getDefaultParams(), ...params };
      // Always init with the fixed logical dimensions
      animStateRef.current = effectModule.init(sampleData, mergedParams, outputWidth, fixedH);
    },
    [sampleData, effectModule, params, outputWidth, fixedH, canvasRef],
  );

  // ── ResizeObserver: update CSS display size only — no re-init ─────────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw < 1 || ch < 1) continue;

        // Fit the logo's aspect inside the available container space
        let w = cw;
        let h = cw / aspect;
        if (h > ch) {
          h = ch;
          w = ch * aspect;
        }
        w = Math.floor(w);
        h = Math.floor(h);

        sizeRef.current = { w, h };

        // Update CSS display size (scales the fixed-resolution buffer)
        const canvas = canvasRef.current;
        if (canvas && canvas.width > 0) {
          canvas.style.width  = `${w}px`;
          canvas.style.height = `${h}px`;
        }

        // Trigger the very first init once we know the container size
        if (!animStateRef.current) {
          initEffect();
        }
      }
    });

    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [aspect, initEffect, canvasRef]);

  // ── Re-init when sampleData / effectModule / params changes ───────────────
  useEffect(() => {
    if (sizeRef.current.w > 0) {
      initEffect();
    }
  }, [sampleData, effectModule, params, initEffect]);

  // ── RAF draw loop ─────────────────────────────────────────────────────────
  const onFrame = useCallback(
    (t) => {
      if (!ctxRef.current || !animStateRef.current) return;
      effectModule.drawFrame(ctxRef.current, animStateRef.current, t);
    },
    [effectModule],
  );

  useAnimationLoop(onFrame);

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
});

export default AnimatedCanvas;
