import { lerp, sampleBilinear } from '../../engine/utils/math.js';

export function getDefaultParams() {
  return {
    rows: null,       // null = auto-match sampleData.rows
    maxLength: 1.0,
    minLength: 0.05,
    minStroke: 0.5,   // minimum stroke width (px)
    maxStroke: 4.0,   // maximum stroke width (px)
    speed: 1.5,       // rad/s — wave travel speed
    waveFreq: 0.10,   // spatial frequency (rad per column)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'minStroke',  label: 'Min W',   min: 0.1, max: 3,   step: 0.1,  default: 0.5  },
    { key: 'maxStroke',  label: 'Max W',   min: 1,   max: 12,  step: 0.5,  default: 4.0  },
    { key: 'maxLength',  label: 'Length',  min: 0.2, max: 1.0, step: 0.01, default: 1.0  },
    { key: 'waveFreq',   label: 'Spacing', min: 0.01,max: 0.5, step: 0.01, default: 0.10 },
    { key: 'speed',      label: 'Speed',   min: 0.1, max: 5,   step: 0.1,  default: 1.5  },
  ];
}

/**
 * Per-cell vertical dash approach — mirrors horizontal-lines-anim.js but rotated 90°.
 *
 * For each (column, row) cell: darkness drives dash height.
 * A traveling wave left→right modulates stroke width per column.
 * This faithfully preserves any logo shape (round letters, counters, etc.)
 * because each cell is sampled independently.
 */
export function init(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  const merged = { ...getDefaultParams(), ...params };
  const { maxLength, minLength } = merged;
  const safeMaxLength = Math.max(maxLength, minLength);

  // Use grid cols × rows for 1:1 cell density
  const cols = gridCols;
  const rows = merged.rows ?? gridRows;

  const cellW = outputWidth / cols;
  const cellH = outputHeight / rows;

  const colMeta = [];
  const segmentsFlat = [];

  for (let c = 0; c < cols; c++) {
    const cx = c * cellW + cellW / 2;
    const u = cols > 1 ? c / (cols - 1) : 0.5;

    const colSegs = [];
    for (let r = 0; r < rows; r++) {
      const v = rows > 1 ? r / (rows - 1) : 0.5;
      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const h = lerp(minLength, safeMaxLength, darkness) * cellH;
      if (h < 0.3) continue;

      const cy = r * cellH + cellH / 2;
      colSegs.push(cy - h / 2, cy + h / 2);
    }

    colMeta.push({ cx, segOffset: segmentsFlat.length, segCount: colSegs.length / 2 });
    for (const val of colSegs) segmentsFlat.push(val);
  }

  const segData = new Float32Array(segmentsFlat);

  return {
    colMeta,
    segData,
    cols,
    cellW,
    outputWidth,
    outputHeight,
    params: merged,
  };
}

export function drawFrame(ctx, animState, t) {
  const { colMeta, segData, cols, cellW, outputWidth, outputHeight, params } = animState;
  const { speed, waveFreq, minStroke, maxStroke, color } = params;

  const safeMaxStroke = Math.max(minStroke, maxStroke);
  const safeMinStroke = Math.min(minStroke, safeMaxStroke);
  // Cap stroke to cell width so adjacent lines don't visually merge
  const maxStrokeByCell = cellW * 1.35;
  const effectiveMaxStroke = Math.min(safeMaxStroke, maxStrokeByCell);
  const effectiveMinStroke = Math.min(safeMinStroke, effectiveMaxStroke);

  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';

  for (let c = 0; c < cols; c++) {
    const meta = colMeta[c];
    if (!meta || meta.segCount === 0) continue;

    // Traveling wave left → right
    const wave = 0.5 + 0.5 * Math.sin(t * speed - c * waveFreq);
    const strokeW = lerp(effectiveMinStroke, effectiveMaxStroke, wave);
    ctx.lineWidth = strokeW;

    const offset = meta.segOffset;
    const count  = meta.segCount;
    const x      = meta.cx;

    for (let s = 0; s < count; s++) {
      const y1 = segData[offset + s * 2];
      const y2 = segData[offset + s * 2 + 1];
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
  }
}
