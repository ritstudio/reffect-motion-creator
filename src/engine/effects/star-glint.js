/**
 * star-glint.js — Static SVG 효과 모듈
 */

import { lerp, sampleBilinear } from '../utils/math.js';

// 일관된 랜덤값을 갖기 위한 간단한 시드 난수 생성기
function pseudoRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export function getDefaultParams() {
    return {
        density: 80,
        scale: 15,
        sharpness: 0.7,
        jitter: 5,
        speed: 4.0,     // animate-only
        color: '#000000',
    };
}

export function getParamSchema() {
    return [
        { key: 'density', label: 'Density', min: 30, max: 120, step: 1, default: 80 },
        { key: 'scale', label: 'Scale', min: 2, max: 20, step: 0.5, default: 10 },
        { key: 'sharpness', label: 'Sharpness', min: 0.1, max: 0.9, step: 0.05, default: 0.7 },
        { key: 'jitter', label: 'Jitter', min: 0, max: 15, step: 1, default: 2 },
        { key: 'speed', label: 'Speed', min: 0, max: 10, step: 0.1, default: 4 },
    ];
}

export function generate(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { density, scale: maxScale, sharpness, jitter, color } = { ...getDefaultParams(), ...params };

    const cols = Math.floor(density);
    const cellW = outputWidth / cols;
    const rows = Math.floor(outputHeight / cellW);
    const cellH = cellW;

    const minScale = 1.0;

    const paths = [];

    for (let r = 0; r < rows; r++) {
        const v = rows > 1 ? r / (rows - 1) : 0.5;
        for (let c = 0; c < cols; c++) {
            const u = cols > 1 ? c / (cols - 1) : 0.5;

            const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
            const darkness = 1 - brightness;

            // 1. Background Skip: 로고 실루엣 밖의 여백은 무시
            if (darkness < 0.3) {
                continue;
            }

            const seed = r * cols + c;
            const rx = pseudoRandom(seed * 1.1) - 0.5;
            const ry = pseudoRandom(seed * 1.2) - 0.5;
            const rPhase = pseudoRandom(seed * 1.3) * Math.PI * 2;

            // 셀 밖으로 과도하게 튀어나가지 않도록 Jitter 제한
            const maxJitter = Math.min(jitter, cellW * 0.8);
            const cx = c * cellW + cellW / 2 + rx * maxJitter;
            const cy = r * cellH + cellH / 2 + ry * maxJitter;

            // Static 상태이므로 시간 t=0, 무작위 위상만 사용하여 반짝임 결정
            const wave = 0.5 + 0.5 * Math.sin(rPhase);

            // 어두운 영역일수록 굵어지며, 파장에 따라 크기가 변함
            const weight = lerp(darkness * 0.2, darkness, wave);

            // 로고 형태를 뭉개지 않도록(블리딩 방지) 최대 크기를 셀 너비의 특정 비율로 제한
            const effectiveMaxScale = Math.min(maxScale, cellW * 1.5);
            const currentScale = lerp(minScale, effectiveMaxScale, weight);

            if (currentScale < 0.5) continue;

            // 십자별 뾰족함 계산
            const cpDist = currentScale * (1 - sharpness);

            let d = `M ${cx.toFixed(1)},${(cy - currentScale).toFixed(1)} `;
            d += `Q ${(cx + cpDist).toFixed(1)},${(cy - cpDist).toFixed(1)} ${(cx + currentScale).toFixed(1)},${cy.toFixed(1)} `;
            d += `Q ${(cx + cpDist).toFixed(1)},${(cy + cpDist).toFixed(1)} ${cx.toFixed(1)},${(cy + currentScale).toFixed(1)} `;
            d += `Q ${(cx - cpDist).toFixed(1)},${(cy + cpDist).toFixed(1)} ${(cx - currentScale).toFixed(1)},${cy.toFixed(1)} `;
            d += `Q ${(cx - cpDist).toFixed(1)},${(cy - cpDist).toFixed(1)} ${cx.toFixed(1)},${(cy - currentScale).toFixed(1)} `;
            d += 'Z';

            paths.push(`<path d="${d}" fill="${color}" stroke="none" />`);
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  ${paths.join('\n  ')}
</svg>`;
}
