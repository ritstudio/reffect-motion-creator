import { lerp, mulberry32, sampleBilinear } from '../../engine/utils/math.js';

export function getDefaultParams() {
  return {
    maxDots: 6000,
    maxRadius: 6,
    minRadius: 0.5,
    seed: 42,
    scatter: 1.0,   // jitter spread: 0 = tight inside logo, 3 = diffuse cloud
    speed: 1.8,     // rad/s — breathing speed
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'maxDots',   label: 'Count',   min: 500, max: 12000, step: 100, default: 6000 },
    { key: 'maxRadius', label: 'Max R',   min: 1,   max: 15,    step: 0.5, default: 6    },
    { key: 'minRadius', label: 'Min R',   min: 0.1, max: 3,     step: 0.1, default: 0.5  },
    { key: 'scatter',   label: 'Scatter', min: 0,   max: 3,     step: 0.1, default: 1.0  },
    { key: 'speed',     label: 'Speed',   min: 0.1, max: 6,     step: 0.1, default: 1.8  },
  ];
}

export function init(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  const { maxDots, maxRadius, minRadius, seed, scatter } = {
    ...getDefaultParams(),
    ...params,
  };
  const densityPower = 1.8; // internal — not user-controlled
  const safeMinRadius = Math.min(minRadius, maxRadius);
  const safeMaxRadius = Math.max(minRadius, maxRadius);
  const dotCount = Math.max(1, Math.round(maxDots));

  const rand = mulberry32(seed);

  // Build cumulative weight table — dark pixels attract more particles
  const weights = [];
  let totalWeight = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const darkness = 1 - grid[r][c];
      const w = Math.pow(darkness, densityPower) + 0.02;
      totalWeight += w;
      weights.push(totalWeight);
    }
  }

  // With rectangular grid (e.g. 300×62) cellW/cellH correctly represent logo proportions
  const cellW = outputWidth / gridCols;
  const cellH = outputHeight / gridRows;

  const px = new Float32Array(dotCount);
  const py = new Float32Array(dotCount);
  const pr = new Float32Array(dotCount);
  const ph = new Float32Array(dotCount);

  let count = 0;
  for (let i = 0; i < dotCount; i++) {
    // Weighted random cell pick via binary search
    const target = rand() * totalWeight;
    let lo = 0;
    let hi = weights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (weights[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const cellIndex = lo;
    const cr = Math.floor(cellIndex / gridCols);
    const cc = cellIndex % gridCols;

    const x = (cc + 0.5 + (rand() - 0.5) * (1 + scatter)) * cellW;
    const y = (cr + 0.5 + (rand() - 0.5) * (1 + scatter)) * cellH;

    if (x < 0 || x > outputWidth || y < 0 || y > outputHeight) continue;

    const u = x / outputWidth;
    const v = y / outputHeight;
    const darkness = 1 - sampleBilinear(grid, gridCols, gridRows, u, v);

    const baseR = lerp(safeMinRadius, safeMaxRadius, darkness * (0.3 + rand() * 0.7));
    if (baseR < 0.15) continue;

    px[count] = x;
    py[count] = y;
    pr[count] = baseR;
    ph[count] = rand() * Math.PI * 2;
    count++;
  }

  return {
    px, py, pr, ph,
    count,
    outputWidth,
    outputHeight,
    params: { ...getDefaultParams(), ...params },
  };
}

export function drawFrame(ctx, animState, t) {
  const { px, py, pr, ph, count, outputWidth, outputHeight, params } = animState;
  const { speed, minRadius, color } = params;
  const safeMinRadius = Math.min(minRadius, params.maxRadius);

  // Transparent background — no fillRect
  ctx.clearRect(0, 0, outputWidth, outputHeight);

  ctx.fillStyle = color;

  // Batch all particles into a single path for performance
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const pulse = 0.5 + 0.5 * Math.sin(t * speed + ph[i]);
    const r = lerp(safeMinRadius, pr[i], pulse);
    if (r < 0.15) continue;
    ctx.moveTo(px[i] + r, py[i]);
    ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
  }
  ctx.fill();
}
