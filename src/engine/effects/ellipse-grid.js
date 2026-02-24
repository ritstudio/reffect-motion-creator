import { lerp, sampleBilinear } from '../utils/math.js';

export function getDefaultParams() {
  return {
    cols: 60,
    maxRy: 18,          // max vertical radius (px, relative to outputHeight=1000)
    eccentricity: 0.40, // rx = ry * eccentricity
    speed: 4.0,         // animate-only (ignored by generate)
    pulseFrac: 0.5,     // animate-only (ignored by generate)
    color: '#000000',
  };
}

export function getParamSchema() {
  return [
    { key: 'cols', label: 'Grid', min: 10, max: 120, step: 1, default: 60 },
    { key: 'maxRy', label: 'Size', min: 4, max: 40, step: 1, default: 18 },
    { key: 'eccentricity', label: 'Shape', min: 0, max: 1, step: 0.01, default: 0.40 },
    { key: 'speed', label: 'Speed', min: 0.1, max: 6, step: 0.1, default: 4.0 },
    { key: 'pulseFrac', label: 'Pulse', min: 0, max: 1, step: 0.01, default: 0.5 },
  ];
}

/**
 * Grid of ellipses — size driven by logo brightness.
 * Dark areas → large ellipses. Light → tiny or absent.
 * Uses maxRy pixel params scaled relative to outputHeight so values are
 * consistent between tabs.
 */
export function generate(sampleData, params, outputWidth, outputHeight) {
  const { grid, cols: gridCols, rows: gridRows, aspect } = sampleData;
  // speed/pulseFrac are animate-only — ignored here
  const { cols, maxRy, eccentricity, color } = {
    ...getDefaultParams(),
    ...params,
  };

  const rows = Math.max(1, Math.round(cols / aspect));
  const cellW = outputWidth / cols;
  const cellH = outputHeight / rows;

  // Scale maxRy from the 1000px reference height to actual outputHeight
  const scale = outputHeight / 1000;
  const ryMax = maxRy * scale;

  const elements = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5;
      const v = rows > 1 ? r / (rows - 1) : 0.5;
      const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
      const darkness = 1 - brightness;

      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + cellH / 2;

      const ry = lerp(0, ryMax, darkness);
      const rx = Math.max(ry * eccentricity, 0.5);

      if (rx < 0.3 && ry < 0.3) continue;

      // No rotation in static generate mode
      elements.push(
        `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${color}"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  ${elements.join('\n  ')}
</svg>`;
}
