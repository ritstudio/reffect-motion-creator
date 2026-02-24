import { lerp, sampleBilinear } from '../../engine/utils/math.js';

export function getDefaultParams() {
  return {
    rows: null,       // null = auto-match sampleData.rows (e.g. 62 for FILMER)
    maxLength: 1.0,
    minLength: 0.08,
    minStroke: 0.5,   // minimum stroke width (px)
    maxStroke: 6.0,   // maximum stroke width (px)
    speed: 4.0,       // rad/s — wave travel speed
    waveFreq: 0.20,   // spatial frequency (rad per row)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'minStroke', label: 'Min Width', min: 0.1, max: 3, step: 0.1, default: 0.5 },
    { key: 'maxStroke', label: 'Max Width', min: 1, max: 10, step: 0.5, default: 6.0 },
    { key: 'maxLength', label: 'Length', min: 0.2, max: 1.0, step: 0.01, default: 1.0 },
    { key: 'waveFreq', label: 'Spacing', min: 0.01, max: 0.5, step: 0.01, default: 0.20 },
    { key: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 4.0 },
  ];
}

export function init(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  const merged = { ...getDefaultParams(), ...params };
  const { maxLength, minLength } = merged;
  const safeMaxLength = Math.max(maxLength, minLength);

  // Use grid rows by default (e.g. 62 for FILMER) — keeps row density sensible
  const rows = merged.rows ?? gridRows;

  const cellH = outputHeight / rows;
  const cols = gridCols;
  const cellW = outputWidth / cols;

  const rowMeta = [];
  const segmentsFlat = [];

  for (let r = 0; r < rows; r++) {
    const cy = r * cellH + cellH / 2;
    const v = rows > 1 ? r / (rows - 1) : 0.5;

    const rowSegs = [];
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5;
      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const w = lerp(minLength, safeMaxLength, darkness) * cellW;
      if (w < 0.3) continue;

      const cx = c * cellW + cellW / 2;
      rowSegs.push(cx - w / 2, cx + w / 2);
    }

    rowMeta.push({ y: cy, segOffset: segmentsFlat.length, segCount: rowSegs.length / 2 });
    for (const val of rowSegs) segmentsFlat.push(val);
  }

  const segData = new Float32Array(segmentsFlat);

  return {
    rowMeta,
    segData,
    rows,
    cellH,
    outputWidth,
    outputHeight,
    params: merged,
  };
}

export function drawFrame(ctx, animState, t) {
  const { rowMeta, segData, rows, cellH, outputWidth, outputHeight, params } = animState;
  const { speed, waveFreq, minStroke, maxStroke, color } = params;
  const safeMaxStroke = Math.max(minStroke, maxStroke);
  const safeMinStroke = Math.min(minStroke, safeMaxStroke);
  const maxStrokeByCell = cellH * 1.35;
  const effectiveMaxStroke = Math.min(safeMaxStroke, maxStrokeByCell);
  const effectiveMinStroke = Math.min(safeMinStroke, effectiveMaxStroke);

  // Transparent background — no fillRect
  ctx.clearRect(0, 0, outputWidth, outputHeight);

  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';

  for (let r = 0; r < rows; r++) {
    const meta = rowMeta[r];
    if (!meta || meta.segCount === 0) continue;

    // Traveling wave top → bottom
    const wave = 0.5 + 0.5 * Math.sin(t * speed - r * waveFreq);
    const strokeW = lerp(effectiveMinStroke, effectiveMaxStroke, wave);
    ctx.lineWidth = strokeW;

    const offset = meta.segOffset;
    const count = meta.segCount;
    const y = meta.y;

    for (let s = 0; s < count; s++) {
      const x1 = segData[offset + s * 2];
      const x2 = segData[offset + s * 2 + 1];
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
  }
}
