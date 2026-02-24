import { lerp, sampleBilinear } from '../../engine/utils/math.js';

export function getDefaultParams() {
  return {
    cols: 60,
    maxRy: 18,          // max vertical radius in logo-dark areas (px, at outputHeight=1000)
    eccentricity: 0.40, // rx = ry * eccentricity (narrow/tall shape)
    speed: 2.0,         // rad/s
    pulseFrac: 0.5,     // fraction of baseRy that oscillates
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'cols',         label: 'Columns',  min: 10,  max: 120, step: 1,    default: 60   },
    { key: 'maxRy',        label: 'Size',     min: 4,   max: 40,  step: 1,    default: 18   },
    { key: 'eccentricity', label: 'Shape',    min: 0,   max: 1,   step: 0.01, default: 0.40 },
    { key: 'pulseFrac',    label: 'Pulse',    min: 0,   max: 1,   step: 0.01, default: 0.5  },
    { key: 'speed',        label: 'Speed',      min: 0.1, max: 6,  step: 0.1,  default: 2.0  },
  ];
}

export function init(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  const merged = { ...getDefaultParams(), ...params };
  const { cols: paramCols, maxRy } = merged;

  const cols = paramCols;
  // Auto-derive rows from grid aspect so cells are square-ish
  const gridAspect = gridCols / gridRows; // e.g. 300/62 = 4.84
  const rows = Math.max(1, Math.round(cols / gridAspect));
  // FILMER: cols=60 → rows=Math.round(60/4.84)=12

  const cellW = outputWidth / cols;
  const cellH = outputHeight / rows;

  // Scale maxRy from 1000px reference to actual outputHeight
  const scale = outputHeight / 1000;
  const ryMax = maxRy * scale;

  // Store: cx, cy, baseRy, phase for each cell
  const cellData = new Float32Array(cols * rows * 4);

  // Fixed diagonal phase offset for wave
  const waveFreqFixed = 0.35;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5;
      const v = rows > 1 ? r / (rows - 1) : 0.5;

      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + cellH / 2;

      const baseRy = lerp(0, ryMax, darkness);
      const phase = (r + c) * waveFreqFixed; // diagonal wave

      const idx = (r * cols + c) * 4;
      cellData[idx + 0] = cx;
      cellData[idx + 1] = cy;
      cellData[idx + 2] = baseRy;
      cellData[idx + 3] = phase;
    }
  }

  return {
    cellData,
    cols,
    rows,
    outputWidth,
    outputHeight,
    params: merged,
  };
}

export function drawFrame(ctx, animState, t) {
  const { cellData, cols, rows, outputWidth, outputHeight, params } = animState;
  const { speed, eccentricity, pulseFrac, color } = params;

  // Transparent background — no fillRect
  ctx.clearRect(0, 0, outputWidth, outputHeight);

  ctx.fillStyle = color;

  const total = cols * rows;
  for (let i = 0; i < total; i++) {
    const cx     = cellData[i * 4 + 0];
    const cy     = cellData[i * 4 + 1];
    const baseRy = cellData[i * 4 + 2];
    const phase  = cellData[i * 4 + 3];

    const pulse = 0.5 + 0.5 * Math.sin(t * speed + phase);
    const ry = lerp(baseRy * (1 - pulseFrac), baseRy, pulse);
    const rx = Math.max(ry * eccentricity, 0.5);

    if (ry < 0.5) continue;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
