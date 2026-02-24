import { useState, useMemo, useRef } from 'react';
import AnimatedCanvas from '../animate/AnimatedCanvas.jsx';
import ParamSlider from './ParamSlider.jsx';

// ── Math utils inlined for standalone HTML export ─────────────────────────
const MATH_UTILS_SRC = `
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sampleBilinear(grid, cols, rows, u, v) {
  const x = u * (cols - 1);
  const y = v * (rows - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const fx = x - x0, fy = y - y0;
  return (
    grid[y0][x0] * (1 - fx) * (1 - fy) +
    grid[y0][x1] * fx       * (1 - fy) +
    grid[y1][x0] * (1 - fx) * fy +
    grid[y1][x1] * fx       * fy
  );
}
`.trim();

function buildStandaloneHTML(title, animModule, sampleData, params) {
  const gridJSON = JSON.stringify(
    sampleData.grid.map((row) => Array.from(row)),
  );
  const getDefaultParamsSrc = animModule.getDefaultParams.toString();
  const initSrc             = animModule.init.toString();
  const drawFrameSrc        = animModule.drawFrame.toString();
  const paramsJSON          = JSON.stringify(params);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Logo Motion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: transparent; }
    canvas { display: block; }
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const SAMPLE_DATA = {
  grid: ${gridJSON},
  cols: ${sampleData.cols},
  rows: ${sampleData.rows},
  svgWidth:  ${sampleData.svgWidth},
  svgHeight: ${sampleData.svgHeight},
};
const LOGO_ASPECT = SAMPLE_DATA.svgWidth / SAMPLE_DATA.svgHeight;
const PARAMS = ${paramsJSON};

${MATH_UTILS_SRC}

const getDefaultParams = ${getDefaultParamsSrc};
const init             = ${initSrc};
const drawFrame        = ${drawFrameSrc};

const canvas = document.getElementById('c');
let ctx, animState, rafId;

function setup(w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  animState = init(SAMPLE_DATA, { ...getDefaultParams(), ...PARAMS }, w, h);
}

function loop(ts) {
  rafId = requestAnimationFrame(loop);
  drawFrame(ctx, animState, ts / 1000);
}

function resize() {
  if (rafId) cancelAnimationFrame(rafId);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw, h = vw / LOGO_ASPECT;
  if (h > vh) { h = vh; w = vh * LOGO_ASPECT; }
  w = Math.floor(w); h = Math.floor(h);
  canvas.style.position = 'fixed';
  canvas.style.left = Math.round((vw - w) / 2) + 'px';
  canvas.style.top  = Math.round((vh - h) / 2) + 'px';
  setup(w, h);
  rafId = requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
</script>
</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * EffectPairPanel — unified panel for both Generate and Animate modes.
 *
 * In Generate mode: renders static SVG via genModule.generate()
 * In Animate mode:  renders canvas animation via animModule.init/drawFrame
 *
 * Both modes share the same params (passed from App.jsx), so switching
 * tabs preserves all slider values.
 *
 * Props:
 *   mode         — 'generate' | 'animate'
 *   title        — display name
 *   sampleData   — brightness grid from svg-sampler
 *   genModule    — { generate, getDefaultParams, getParamSchema }
 *   animModule   — { init, drawFrame, getDefaultParams, getParamSchema }
 *   outputWidth  — SVG coordinate width (generate mode only)
 *   outputHeight — SVG coordinate height (generate mode only)
 *   params       — current param values (from App.jsx sharedParams)
 *   onParamChange — (key, value) => void — lifted to App.jsx
 */
export default function EffectPairPanel({
  mode,
  title,
  sampleData,
  genModule,
  animModule,
  outputWidth,
  outputHeight,
  params,
  onParamChange,
}) {
  // Schema comes from animModule (the canonical unified schema)
  const schema = useMemo(() => animModule.getParamSchema(), [animModule]);
  const motionOnlyKeys = new Set(['speed', 'waveFreq', 'waveAmp', 'pulseFrac']);
  const [collapsed, setCollapsed]     = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const canvasRef = useRef(null);

  const aspect = sampleData ? sampleData.svgWidth / sampleData.svgHeight : 1;

  // Generate mode: compute SVG string reactively
  const svgString = useMemo(() => {
    if (mode !== 'generate' || !sampleData) return null;
    return genModule.generate(sampleData, params, outputWidth, outputHeight);
  }, [mode, sampleData, params, outputWidth, outputHeight, genModule]);

  // ── Export SVG (generate mode) ────────────────────────────────────────────
  function exportSVG() {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const safeName = title.toLowerCase().replace(/\s+/g, '-');
    downloadBlob(blob, `${safeName}.svg`);
  }

  // ── Export standalone HTML (animate mode) ────────────────────────────────
  function exportCode() {
    const html = buildStandaloneHTML(title, animModule, sampleData, params);
    const blob = new Blob([html], { type: 'text/html' });
    const safeName = title.toLowerCase().replace(/\s+/g, '-');
    downloadBlob(blob, `${safeName}-logo.html`);
  }

  // ── Export WebM — 10-second canvas recording ─────────────────────────────
  function exportWebM() {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const stream   = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
    const chunks = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const safeName = title.toLowerCase().replace(/\s+/g, '-');
      downloadBlob(blob, `${safeName}-logo.webm`);
      setIsRecording(false);
    };

    setIsRecording(true);
    recorder.start();
    setTimeout(() => recorder.stop(), 10_000);
  }

  return (
    <div className="effect-panel">
      {/* ── Header: title + params toggle + export buttons ── */}
      <div className="panel-header">
        <span>{title}</span>

        <div className="export-buttons">
          {mode === 'generate' ? (
            <button className="export-btn export-btn-svg" onClick={exportSVG}>
              SVG
            </button>
          ) : (
            <>
              <button className="export-btn export-btn-code" onClick={exportCode}>
                Code
              </button>
              <button
                className="export-btn export-btn-webm"
                onClick={exportWebM}
                disabled={isRecording}
              >
                {isRecording ? '● 10s' : 'WebM'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Preview area: SVG (generate) or Canvas (animate) ── */}
      <div className="panel-preview">
        {mode === 'generate' ? (
          svgString && (
            <div
              className="preview-aspect-box"
              style={{ '--logo-aspect': aspect }}
            >
              <div className="preview-svg-wrap" dangerouslySetInnerHTML={{ __html: svgString }} />
            </div>
          )
        ) : (
          sampleData && (
            <div
              className="preview-aspect-box"
              style={{ '--logo-aspect': aspect }}
            >
              <AnimatedCanvas
                ref={canvasRef}
                sampleData={sampleData}
                effectModule={animModule}
                aspect={aspect}
                params={params}
                outputWidth={outputWidth}
                outputHeight={outputHeight}
              />
            </div>
          )
        )}
      </div>

      {/* ── Param sliders — shared between modes ── */}
      {sampleData && <div className={`panel-controls ${collapsed ? 'collapsed' : ''}`}>
        {!collapsed && (
          <div className="panel-controls-main">
            <div className="panel-controls-list">
              {schema.map((s) => (
                <div key={s.key} style={mode === 'generate' && motionOnlyKeys.has(s.key) ? { visibility: 'hidden' } : undefined}>
                  <ParamSlider
                    schema={s}
                    value={params[s.key] ?? s.default}
                    onChange={onParamChange}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="panel-controls-side">
          <button
            className="toggle-controls"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Show params' : 'Hide params'}
            title={collapsed ? 'Show params' : 'Hide params'}
          >
            <span className={`toggle-arrow${collapsed ? ' collapsed' : ''}`} />
          </button>
        </div>
      </div>}
    </div>
  );
}
