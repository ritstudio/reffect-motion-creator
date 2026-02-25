/**
 * star-glint-anim.js — Canvas 애니메이션 효과 모듈
 */

import { lerp, sampleBilinear } from '../../engine/utils/math.js';

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
        speed: 4.0,
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

export function init(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { density, jitter } = { ...getDefaultParams(), ...params };

    const cols = Math.floor(density);
    const cellW = outputWidth / cols;
    const rows = Math.floor(outputHeight / cellW);
    const cellH = cellW;

    const total = rows * cols;

    const sx = new Float32Array(total);
    const sy = new Float32Array(total);
    const sd = new Float32Array(total);
    const sPhase = new Float32Array(total);

    let n = 0;
    for (let r = 0; r < rows; r++) {
        const v = rows > 1 ? r / (rows - 1) : 0.5;
        for (let c = 0; c < cols; c++) {
            const u = cols > 1 ? c / (cols - 1) : 0.5;

            const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
            const darkness = 1 - brightness;

            // 로고 없는 빈 공간은 렌더링 풀에서 아예 제외
            if (darkness >= 0.3) {
                const seed = r * cols + c;
                const rx = pseudoRandom(seed * 1.1) - 0.5;
                const ry = pseudoRandom(seed * 1.2) - 0.5;
                const rPhase = pseudoRandom(seed * 1.3) * Math.PI * 2;

                // 셀 너비를 벗어나지 않는 적절한 Jitter 범위 산출
                const maxJitter = Math.min(jitter, cellW * 0.8);
                sx[n] = c * cellW + cellW / 2 + rx * maxJitter;
                sy[n] = r * cellH + cellH / 2 + ry * maxJitter;
                sd[n] = darkness;
                sPhase[n] = rPhase;

                n++;
            }
        }
    }

    return {
        count: n,
        sx, sy, sd, sPhase,
        outputWidth, outputHeight, cellW,
        params: { ...getDefaultParams(), ...params }
    };
}

export function drawFrame(ctx, animState, t) {
    const {
        count, sx, sy, sd, sPhase,
        outputWidth, outputHeight, cellW,
        params
    } = animState;

    const { scale: maxScale, sharpness, speed, color } = params;
    const minScale = 1.0;

    // 매 프레임 초기화
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.fillStyle = color;

    for (let i = 0; i < count; i++) {
        const cx = sx[i];
        const cy = sy[i];
        const darkness = sd[i];
        const phase = sPhase[i];

        // 시간 흐름(speed)과 랜덤 위상(phase)으로 점멸 효과(Twinkle) 생성
        const wave = 0.5 + 0.5 * Math.sin(t * speed + phase);

        const weight = lerp(darkness * 0.2, darkness, wave);
        const effectiveMaxScale = Math.min(maxScale, cellW * 1.5);
        const currentScale = lerp(minScale, effectiveMaxScale, weight);

        if (currentScale < 0.5) continue;

        // 뾰족함 조정 (가운데를 파고드는 제어점 거리)
        const cpDist = currentScale * (1 - sharpness);

        ctx.beginPath();
        ctx.moveTo(cx, cy - currentScale);
        ctx.quadraticCurveTo(cx + cpDist, cy - cpDist, cx + currentScale, cy);
        ctx.quadraticCurveTo(cx + cpDist, cy + cpDist, cx, cy + currentScale);
        ctx.quadraticCurveTo(cx - cpDist, cy + cpDist, cx - currentScale, cy);
        ctx.quadraticCurveTo(cx - cpDist, cy - cpDist, cx, cy - currentScale);
        ctx.closePath();
        ctx.fill();
    }
}
