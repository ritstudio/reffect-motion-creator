import { lerp, sampleBilinear } from '../utils/math.js';

export function getDefaultParams() {
  return {
    rows: null,         // null = auto-match sampleData.rows
    maxLength: 1.0,
    minLength: 0.08,
    minStroke: 0.5,     // min stroke width (px)
    maxStroke: 11.0,    // max stroke width (px)
    speed: 1.5,         // animate-only (ignored by generate)
    waveFreq: 0.20,     // animate-only (ignored by generate)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'minStroke',  label: 'Min Stroke', min: 0.1, max: 3,   step: 0.1,  default: 0.5  },
    { key: 'maxStroke',  label: 'Max Stroke', min: 1,   max: 20,  step: 0.5,  default: 11.0 },
    { key: 'maxLength',  label: 'Max Length', min: 0.2, max: 1.0, step: 0.01, default: 1.0  },
    { key: 'speed',      label: 'Anim Speed', min: 0.1, max: 5,   step: 0.1,  default: 1.5  },
    { key: 'waveFreq',   label: 'Wave Spacing',min: 0.01,max: 0.5,step: 0.01, default: 0.20 },
  ];
}

/**
 * Horizontal lines — per-cell segments whose length maps to darkness.
 * Each grid cell gets a short horizontal line. Dark = long, light = short.
 * Stroke width = average of minStroke and maxStroke (shared with animate).
 */
export function generate(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  // speed/waveFreq are animate-only — ignored here
  const { maxLength, minLength, minStroke, maxStroke, color } = {
    ...getDefaultParams(),
    ...params,
  };
  const safeMinStroke = Math.min(minStroke, maxStroke);
  const safeMaxStroke = Math.max(minStroke, maxStroke);
  const safeMaxLength = Math.max(maxLength, minLength);

  // Use gridRows to keep row count consistent with the animate version
  const rows = gridRows;

  const cellH = outputHeight / rows;
  const maxStrokeByCell = cellH * 1.35;
  const effectiveMaxStroke = Math.min(safeMaxStroke, maxStrokeByCell);
  const effectiveMinStroke = Math.min(safeMinStroke, effectiveMaxStroke);
  // Stroke width = midpoint between min and max (static snapshot)
  const strokeWidth = (effectiveMinStroke + effectiveMaxStroke) / 2;

  const cols = gridCols;
  const cellW = outputWidth / cols;

  let pathD = '';

  for (let r = 0; r < rows; r++) {
    const cy = r * cellH + cellH / 2;
    const v = rows > 1 ? r / (rows - 1) : 0.5;

    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5;
      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const w = lerp(minLength, safeMaxLength, darkness) * cellW;
      if (w < 0.3) continue;

      const cx = c * cellW + cellW / 2;
      const x1 = cx - w / 2;
      const x2 = cx + w / 2;

      pathD += `M${x1.toFixed(1)},${cy.toFixed(1)}L${x2.toFixed(1)},${cy.toFixed(1)}`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  <path d="${pathD}" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linecap="butt" fill="none"/>
</svg>`;
}
