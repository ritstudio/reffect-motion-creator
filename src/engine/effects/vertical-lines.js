import { lerp, sampleBilinear } from '../utils/math.js';

export function getDefaultParams() {
  return {
    rows: null,       // null = auto-match sampleData.rows
    maxLength: 1.0,
    minLength: 0.05,
    minStroke: 0.5,
    maxStroke: 4.0,
    speed: 1.5,       // animate-only (ignored by generate)
    waveFreq: 0.10,   // animate-only (ignored by generate)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'minStroke',  label: 'Min W',   min: 0.1, max: 3,   step: 0.1,  default: 0.5  },
    { key: 'maxStroke',  label: 'Max W',   min: 1,   max: 12,  step: 0.5,  default: 4.0  },
    { key: 'maxLength',  label: 'Length',  min: 0.2, max: 1.0, step: 0.01, default: 1.0  },
    { key: 'speed',      label: 'Anim Speed', min: 0.1, max: 5,   step: 0.1,  default: 1.5  },
    { key: 'waveFreq',   label: 'Wave Spacing', min: 0.01, max: 0.5, step: 0.01, default: 0.10 },
  ];
}

/**
 * Vertical lines — per-cell approach mirroring horizontal-lines.js.
 * Each (col, row) cell gets a vertical dash of height proportional to darkness.
 * This faithfully preserves any logo shape.
 * Stroke width uses midpoint between min and max (static snapshot).
 */
export function generate(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  // speed/waveFreq are animate-only — ignored here
  const { minStroke, maxStroke, maxLength, minLength, color } = {
    ...getDefaultParams(),
    ...params,
  };
  const safeMaxLength = Math.max(maxLength, minLength);

  const cols = gridCols;
  const rows = params.rows ?? gridRows;

  const cellW = outputWidth / cols;
  const cellH = outputHeight / rows;

  // Static: use midpoint stroke width
  const strokeWidth = (minStroke + maxStroke) / 2;

  let pathD = '';

  for (let c = 0; c < cols; c++) {
    const cx = c * cellW + cellW / 2;
    const u = cols > 1 ? c / (cols - 1) : 0.5;

    for (let r = 0; r < rows; r++) {
      const v = rows > 1 ? r / (rows - 1) : 0.5;
      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const h = lerp(minLength, safeMaxLength, darkness) * cellH;
      if (h < 0.5) continue;

      const cy = r * cellH + cellH / 2;
      const y1 = cy - h / 2;
      const y2 = cy + h / 2;

      pathD += `M${cx.toFixed(1)},${y1.toFixed(1)}L${cx.toFixed(1)},${y2.toFixed(1)}`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  <path d="${pathD}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="butt" fill="none"/>
</svg>`;
}
