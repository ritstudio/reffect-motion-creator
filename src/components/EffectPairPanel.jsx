import { useState, useMemo, useRef } from 'react';
import GIF from 'gif.js';
import AnimatedCanvas from '../animate/AnimatedCanvas.jsx';
import ParamSlider from './ParamSlider.jsx';

// ── Math utils inlined for standalone HTML export ─────────────────────────
// These are injected as globals so that effect module functions serialised
// via .toString() can reference lerp / sampleBilinear / mulberry32 directly.
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

// ── Build standalone HTML — embeds sampleData + current params ────────────
function buildStandaloneHTML(title, animModule, sampleData, params) {
  const gridJSON = JSON.stringify(
    sampleData.grid.map((row) => Array.from(row)),
  );
  const getDefaultParamsSrc = animModule.getDefaultParams.toString();
  const initSrc = animModule.init.toString();
  const drawFrameSrc = animModule.drawFrame.toString();
  // Serialise the *current* params so the exported HTML respects slider values
  const paramsJSON = JSON.stringify(params);

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
// Current params from the editor (slider values at time of export)
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
  // Merge editor params over defaults so exported file matches what was seen
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
<\/script>
</body>
</html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
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
  const [collapsed, setCollapsed] = useState(false);
  const [gifProgress, setGifProgress] = useState(null); // null | 0-100
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
    if (!sampleData) return;
    // Pass current params so exported HTML reflects slider values
    const html = buildStandaloneHTML(title, animModule, sampleData, params);
    const blob = new Blob([html], { type: 'text/html' });
    const safeName = title.toLowerCase().replace(/\s+/g, '-');
    downloadBlob(blob, `${safeName}-logo.html`);
  }

  // ── Export GIF — transparent background, ~3 sec loop ─────────────────────
  // gif.js의 transparent 옵션 동작 방식:
  //   - canvas에서 alpha=0인 픽셀을 GIF 팅팩스 피랫 엔트리로 매핑
  //   - transparent 값은 "어떤 RGB 색상을 투명 팩레트 인덱스로 쓸 것인가"
  //   - 중요: transparent RGB == 효과 그리기 색상(검정)0x000000이면
  //     gif.js가 팸레트 인덱스를 혼동해서 효과도 투명 처리→ 아무것도 안보임
  //   → 0x00ff00 (라임그린)을 투명 인덱스로 지정하면 충돌 없음
  //   → 배경은 clearRect(알파=0)로 지우면 gif.js가 알파=0 픽셀→투명으로 인식
  function exportGIF() {
    const canvas = canvasRef.current;
    if (!canvas || gifProgress !== null) return;

    const GIF_FPS = 20;
    const GIF_SECS = 3;
    const TOTAL_FRAMES = GIF_FPS * GIF_SECS;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = Math.round(canvas.width / dpr);
    const logicalH = Math.round(canvas.height / dpr);

    const offscreen = document.createElement('canvas');
    offscreen.width = logicalW;
    offscreen.height = logicalH;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

    const mergedParams = { ...animModule.getDefaultParams(), ...params };
    const animState = animModule.init(sampleData, mergedParams, logicalW, logicalH);

    const gif = new GIF({
      workers: 2,
      quality: 6,
      width: logicalW,
      height: logicalH,
      workerScript: '/gif.worker.js',
      // transparent 옵션 없이 흡색 배경을 사용
      // gif.js의 팅작스 투명도 정적 포맷이 팔레트 양자화 문제로 신뢰비 낮음
    });

    setGifProgress(0);

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const t = i / GIF_FPS;
      // ⚠️ drawFrame 내부에서 ctx.clearRect()를 먼저 호출하므로
      // fillRect로 미리 깐 배경이 지워짐.
      // destination-over: 기존 픽셀 아래에 새로운 색상을 합성
      // → drawFrame 이후에 흰색을 효과 "아래" 에 깔기
      animModule.drawFrame(offCtx, animState, t);
      offCtx.globalCompositeOperation = 'destination-over';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, logicalW, logicalH);
      offCtx.globalCompositeOperation = 'source-over'; // 복원
      gif.addFrame(offCtx, { copy: true, delay: Math.round(1000 / GIF_FPS) });
    }

    gif.on('progress', (p) => setGifProgress(Math.round(p * 100)));

    gif.on('finished', (blob) => {
      const safeName = title.toLowerCase().replace(/\s+/g, '-');
      downloadBlob(blob, `${safeName}-logo.gif`);
      setGifProgress(null);
    });

    gif.render();
  }

  const isExportingGIF = gifProgress !== null;
  const gifLabel = isExportingGIF ? `● ${gifProgress}%` : 'GIF';

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
                className="export-btn export-btn-gif"
                onClick={exportGIF}
                disabled={isExportingGIF}
              >
                {gifLabel}
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
