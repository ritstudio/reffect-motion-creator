import { lerp, mulberry32, sampleBilinear } from '../utils/math.js';

export function getDefaultParams() {
  return {
    maxDots: 6000,
    maxRadius: 6,
    minRadius: 0.5,
    seed: 42,           // internal only — not exposed in schema
    scatter: 1.0,       // jitter spread: 0 = tight inside logo, 3 = diffuse cloud
    speed: 4.0,         // animate-only (ignored by generate)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'maxDots', label: 'Density', min: 500, max: 12000, step: 100, default: 6000 },
    { key: 'maxRadius', label: 'Max Size', min: 1, max: 15, step: 0.5, default: 6 },
    { key: 'minRadius', label: 'Min Size', min: 0.1, max: 3, step: 0.1, default: 0.5 },
    { key: 'scatter', label: 'Spread', min: 0, max: 3, step: 0.1, default: 1.0 },
    { key: 'speed', label: 'Speed', min: 0.1, max: 6, step: 0.1, default: 4.0 },
  ];
}

/**
 * Particle / dot scatter — dots are placed randomly with density
 * proportional to logo darkness.  Uses a seeded PRNG so the pattern
 * is reproducible.
 */
export function generate(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows } = sampleData;
  // speed is animate-only — ignored here
  const { maxDots, maxRadius, minRadius, seed, scatter, color } = {
    ...getDefaultParams(),
    ...params,
  };
  const densityPower = 1.8; // internal — not user-controlled
  const safeMinRadius = Math.min(minRadius, maxRadius);
  const safeMaxRadius = Math.max(minRadius, maxRadius);
  const dotCount = Math.max(1, Math.round(maxDots));

  const rand = mulberry32(seed);

  // Build a cumulative weight table for weighted random cell selection
  const weights = [];
  let totalWeight = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const darkness = 1 - grid[r][c];
      // Add small base weight so even light areas get some sparse dots
      const w = Math.pow(darkness, densityPower) + 0.02;
      totalWeight += w;
      weights.push(totalWeight);
    }
  }

  if (totalWeight === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}"><rect width="${outputWidth}" height="${outputHeight}" fill="none"/></svg>`;
  }

  const cellW = outputWidth / gridCols;
  const cellH = outputHeight / gridRows;

  const circles = [];

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

    const px = (cc + 0.5 + (rand() - 0.5) * (1 + scatter)) * cellW;
    const py = (cr + 0.5 + (rand() - 0.5) * (1 + scatter)) * cellH;

    if (px < 0 || px > outputWidth || py < 0 || py > outputHeight) continue;

    // Sample darkness at actual position for radius sizing
    const u = px / outputWidth;
    const v = py / outputHeight;
    const darkness = 1 - sampleBilinear(grid, gridCols, gridRows, u, v);

    const baseR = lerp(safeMinRadius, safeMaxRadius, darkness * (0.3 + rand() * 0.7));
    if (baseR < 0.15) continue;

    const ph = rand() * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(ph);
    const r = lerp(safeMinRadius, baseR, pulse);

    if (r < 0.15) continue;

    circles.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  ${circles.join('\n  ')}
</svg>`;
}
