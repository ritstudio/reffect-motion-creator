/**
 * line-halftone.js — Static SVG 효과 모듈
 */

import { lerp, sampleBilinear } from '../utils/math.js';

export function getDefaultParams() {
    return {
        density: 80,
        contrast: 15.0,
        pulse: 1.5,
        speed: 3.0,     // animate-only
        color: '#000000',
    };
}

export function getParamSchema() {
    return [
        { key: 'density', label: 'Density', min: 20, max: 150, step: 1, default: 80 },
        { key: 'contrast', label: 'Contrast', min: 1.0, max: 20.0, step: 0.5, default: 12.0 },
        { key: 'pulse', label: 'Pulse', min: 0.1, max: 5.0, step: 0.1, default: 1.5 },
        { key: 'speed', label: 'Speed', min: 0, max: 10, step: 0.1, default: 3 },
    ];
}

export function generate(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { density, contrast, pulse, color } = { ...getDefaultParams(), ...params };

    const rows = Math.floor(density);
    const cellH = outputHeight / rows;

    // X축 곡선을 매우 부드럽게 그리기 위한 해상도(조각 갯수)
    const stepsPerLine = 300;
    const stepW = outputWidth / stepsPerLine;

    const minStroke = 0.5; // 실선 기본 굵기
    // 블리딩(뭉개짐) 방지를 위해 최대 굵기를 셀 높이의 1.8배까지만 허용
    const maxStroke = Math.min(contrast, cellH * 1.8);

    const paths = [];

    for (let r = 0; r < rows; r++) {
        const cy = r * cellH + cellH / 2;
        const v = rows > 1 ? r / (rows - 1) : 0.5;

        let rowPathD = '';

        for (let c = 0; c < stepsPerLine; c++) {
            const u = c / (stepsPerLine - 1);

            const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
            const darkness = 1 - brightness;

            // 1. Background Skip: 임계치 미만인 빈 배경 영역은 아예 그리지 않음 (로고 실루엣 보존)
            if (darkness < 0.3) {
                continue;
            }

            // 2. Math Lerp & Wave Modulation
            // Static 상태이므로 시간 t=0, 공간적(X축) 파장만 계산 (주파수 pulse)
            const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * pulse);

            // 어두운 영역일수록 굵어지되, 파장에 따라 굵기에 볼륨감을 줌
            const weight = lerp(darkness * 0.2, darkness, wave);
            const strokeW = lerp(minStroke, maxStroke, weight);

            const cx = c * stepW + stepW / 2;
            const x1 = cx - stepW / 2;
            const x2 = cx + stepW / 2 + 0.5; // 약간의 겹침으로 선분이 끊어지지 않게 함

            // 개별 라인 세그먼트 생성 (굵기가 동적이므로 각각의 path로 추가 혹은 svg stroke-width 활용)
            // SVG 특성상 하나의 <path>는 하나의 stroke-width만 가지므로 조각마다 생성
            paths.push(`<path d="M${x1.toFixed(1)},${cy.toFixed(1)}L${x2.toFixed(1)},${cy.toFixed(1)}" stroke="${color}" stroke-width="${strokeW.toFixed(2)}" stroke-linecap="butt" fill="none"/>`);
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="${outputWidth}" height="${outputHeight}" fill="none"/>
  ${paths.join('\n  ')}
</svg>`;
}
