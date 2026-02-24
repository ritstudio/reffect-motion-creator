/**
 * SVG Sampler — renders any SVG to an offscreen canvas and extracts
 * a 2D brightness grid that preserves the logo's natural aspect ratio.
 *
 * brightness: 0 = fully dark (logo present), 1 = fully light (empty)
 */

export async function sampleSVG(svgString, targetCols = 300) {
  const dims = parseSVGDimensions(svgString);
  const logoAspect = dims.width / dims.height; // e.g. 1075/221 = 4.86 for FILMER

  const cols = targetCols;
  // rows preserves the real aspect ratio — no letterboxing, no padding
  const rows = Math.max(1, Math.round(targetCols / logoAspect));
  // FILMER: Math.round(300 / 4.86) = 62

  // Prepare SVG image at exact grid dimensions
  const sizedSvg = ensureSVGSize(svgString, cols, rows);
  const blob = new Blob([sizedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  // Draw SVG filling the entire grid canvas — no padding, no letterbox
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows); // full extent

  // Extract brightness grid
  const imageData = ctx.getImageData(0, 0, cols, rows);
  const { data } = imageData;

  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      row[x] = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
    }
    grid.push(row);
  }

  return {
    grid,
    cols,               // e.g. 300
    rows,               // e.g. 62
    aspect: cols / rows, // real logo aspect ratio (e.g. 4.84)
    svgWidth: dims.width,
    svgHeight: dims.height,
  };
}

/**
 * Ensure the SVG string has explicit width/height attributes.
 */
function ensureSVGSize(svgString, width, height) {
  return svgString.replace(
    /<svg([^>]*)>/,
    (match, attrs) => {
      let s = attrs.replace(/\bwidth\s*=\s*["'][^"']*["']/g, '');
      s = s.replace(/\bheight\s*=\s*["'][^"']*["']/g, '');
      return `<svg${s} width="${width}" height="${height}">`;
    }
  );
}

/**
 * Helper: parse SVG dimensions from string.
 */
export function parseSVGDimensions(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { width: 100, height: 100, aspect: 1 };

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    const w = parts[2];
    const h = parts[3];
    return { width: w, height: h, aspect: w / h };
  }

  const w = parseFloat(svg.getAttribute('width')) || 100;
  const h = parseFloat(svg.getAttribute('height')) || 100;
  return { width: w, height: h, aspect: w / h };
}
