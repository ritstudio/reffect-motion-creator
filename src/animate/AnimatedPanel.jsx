import { useState, useMemo, useRef } from 'react';
import GIF from 'gif.js';
import AnimatedCanvas from './AnimatedCanvas.jsx';
import ParamSlider from '../components/ParamSlider.jsx';

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

// params 인자를 받아 현재 슬라이더 값을 HTML에 직렬화
function buildStandaloneHTML(title, effectModule, sampleData, params) {
  const gridJSON = JSON.stringify(
    sampleData.grid.map((row) => Array.from(row)),
  );
  const getDefaultParamsSrc = effectModule.getDefaultParams.toString();
  const initSrc = effectModule.init.toString();
  const drawFrameSrc = effectModule.drawFrame.toString();
  // 현재 params를 직렬화하여 export된 HTML에 반영
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
 * AnimatedPanel — EffectPanel의 애니메이션 버전.
 * Generate 모드 EffectPanel과 동일한 레이아웃 (.effect-panel 클래스 재사용).
 * 각 패널이 자체 canvasRef, params state, export 기능을 독립적으로 가짐.
 */
export default function AnimatedPanel({ title, sampleData, effectModule, logoName = 'logo' }) {
  const schema = useMemo(() => effectModule.getParamSchema?.() ?? [], [effectModule]);
  const defaults = useMemo(() => effectModule.getDefaultParams(), [effectModule]);

  const [params, setParams] = useState(defaults);
  const [collapsed, setCollapsed] = useState(false);
  const [gifProgress, setGifProgress] = useState(null); // null | 0-100

  const canvasRef = useRef(null);
  const aspect = sampleData.svgWidth / sampleData.svgHeight;

  // logoName에서 확장자를 제거하고 소문자/대시 형태로 변환
  const baseLogoName = logoName.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const exportPrefix = `${baseLogoName}_${safeName}`;

  function handleParam(key, value) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  // 현재 params를 전달해 슬라이더 값이 반영된 HTML export
  function exportCode() {
    const html = buildStandaloneHTML(title, effectModule, sampleData, params, baseW, baseH);
    const blob = new Blob([html], { type: 'text/html' });
    downloadBlob(blob, `${exportPrefix}.html`);
  }

  function exportGIF() {
    const canvas = canvasRef.current;
    if (!canvas || gifProgress !== null) return;

    const GIF_FPS = 20;
    const GIF_SECS = 3;
    const TOTAL_FRAMES = GIF_FPS * GIF_SECS;

    const dpr = window.devicePixelRatio || 1;
    const baseW = Math.round(canvas.width / dpr);
    const baseH = Math.round(canvas.height / dpr);
    // 화면 비율을 그대로 유지하되 고해상도(높이 1080)로 추출
    const scale = 1080 / baseH;
    const logicalW = Math.round(baseW * scale);
    const logicalH = 1080;

    const offscreen = document.createElement('canvas');
    offscreen.width = logicalW;
    offscreen.height = logicalH;
    const offCtx = offscreen.getContext('2d');
    offCtx.scale(scale, scale);

    const mergedParams = { ...effectModule.getDefaultParams(), ...params };
    // 파라미터 스케일 유지를 위해 baseW/baseH 전달
    const animState = effectModule.init(sampleData, mergedParams, baseW, baseH);

    const gif = new GIF({
      workers: 2,
      quality: 6,
      width: logicalW,
      height: logicalH,
      workerScript: '/gif.worker.js',
    });

    setGifProgress(0);

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const t = i / GIF_FPS;
      // drawFrame 내부 clearRect가 배경을 지우므로
      // destination-over로 drawFrame 이후에 흰색을 효과 아래에 합성
      effectModule.drawFrame(offCtx, animState, t);
      offCtx.globalCompositeOperation = 'destination-over';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, baseW, baseH);
      offCtx.globalCompositeOperation = 'source-over';
      gif.addFrame(offCtx, { copy: true, delay: Math.round(1000 / GIF_FPS) });
    }

    gif.on('progress', (p) => setGifProgress(Math.round(p * 100)));
    gif.on('finished', (blob) => {
      downloadBlob(blob, `${exportPrefix}.gif`);
      setGifProgress(null);
    });

    gif.render();
  }

  // ── Export Video — green screen background, 10 sec recording ───────────────
  const [videoProgress, setVideoProgress] = useState(null); // null | 0-10

  function exportVideo() {
    const canvas = canvasRef.current;
    if (!canvas || videoProgress !== null) return;

    const VIDEO_SECS = 10;
    const FPS = 60;

    const dpr = window.devicePixelRatio || 1;
    const baseW = Math.round(canvas.width / dpr);
    const baseH = Math.round(canvas.height / dpr);
    // 화면 비율을 그대로 유지하되 고해상도(높이 1080)로 추출
    const scale = 1080 / baseH;
    const logicalW = Math.round(baseW * scale);
    const logicalH = 1080;

    const offscreen = document.createElement('canvas');
    offscreen.width = logicalW;
    offscreen.height = logicalH;
    const offCtx = offscreen.getContext('2d');

    const mergedParams = { ...effectModule.getDefaultParams(), ...params };
    const animState = effectModule.init(sampleData, mergedParams, logicalW, logicalH);

    const stream = offscreen.captureStream(FPS);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `${exportPrefix}.${ext}`);
      setVideoProgress(null);
    };

    setVideoProgress(0);
    recorder.start();

    let startMs = performance.now();
    let rafId;

    function renderLoop(now) {
      const elapsed = (now - startMs) / 1000;
      if (elapsed >= VIDEO_SECS) {
        recorder.stop();
        return;
      }

      setVideoProgress(Math.floor(elapsed));

      offCtx.clearRect(0, 0, baseW, baseH);
      effectModule.drawFrame(offCtx, animState, elapsed);

      offCtx.globalCompositeOperation = 'destination-over';
      offCtx.fillStyle = '#00ff00'; // Green screen
      offCtx.fillRect(0, 0, baseW, baseH);
      offCtx.globalCompositeOperation = 'source-over';

      rafId = requestAnimationFrame(renderLoop);
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  const isExportingGIF = gifProgress !== null;
  const isExportingVideo = videoProgress !== null;
  const gifLabel = isExportingGIF ? `● ${gifProgress}%` : 'GIF';
  const videoLabel = isExportingVideo ? `● ${videoProgress}s` : 'Video';

  return (
    <div className="effect-panel">
      {/* Header: title + params toggle + export buttons */}
      <div className="panel-header">
        <span>
          {title}
          <button
            className="toggle-controls"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? '+ params' : '- params'}
          </button>
        </span>
        <div className="export-buttons">
          <button className="export-btn" onClick={exportCode}>
            Code
          </button>
          <button
            className="export-btn"
            onClick={exportGIF}
            disabled={isExportingGIF || isExportingVideo}
          >
            {gifLabel}
          </button>
          <button
            className="export-btn export-btn-video"
            onClick={exportVideo}
            disabled={isExportingGIF || isExportingVideo}
          >
            {videoLabel}
          </button>
        </div>
      </div>

      {/* Canvas preview — fills available space, maintains logo aspect ratio */}
      <div className="panel-preview">
        <AnimatedCanvas
          ref={canvasRef}
          sampleData={sampleData}
          effectModule={effectModule}
          aspect={aspect}
          params={params}
        />
      </div>

      {/* Param sliders — same pattern as EffectPanel */}
      <div className={`panel-controls ${collapsed ? 'collapsed' : ''}`}>
        {schema.map((s) => (
          <ParamSlider
            key={s.key}
            schema={s}
            value={params[s.key] ?? s.default}
            onChange={handleParam}
          />
        ))}
      </div>
    </div>
  );
}
