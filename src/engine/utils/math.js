export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleBilinear(grid, cols, rows, u, v) {
  const x = u * (cols - 1);
  const y = v * (rows - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, cols - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const fx = x - x0;
  const fy = y - y0;
  return (
    grid[y0][x0] * (1 - fx) * (1 - fy) +
    grid[y0][x1] * fx * (1 - fy) +
    grid[y1][x0] * (1 - fx) * fy +
    grid[y1][x1] * fx * fy
  );
}

export function map(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}
