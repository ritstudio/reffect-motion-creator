/**
 * line-halftone-anim.js — Canvas 애니메이션 효과 모듈
 */

import { lerp, sampleBilinear } from '../../engine/utils/math.js';

export function getDefaultParams() {
    return {
        density: 80,       // 화면 분할 Y축 개수
        contrast: 15.0,    // 굵기 두께 폭
        pulse: 1.5,        // 물결(Wave) 빈도/주파수
        speed: 3.0,        // 모션의 흐름 속도
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

/**
 * 모바일 및 저사양 환경을 고려, 프레임당 불필요한 연산을 줄이기 위해
 * 고정된 샘플링 값(좌표, 명암도 등)을 Float32Array 로 캐싱합니다.
 */
export function init(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { density } = { ...getDefaultParams(), ...params };

    const rows = Math.floor(density);
    const cellH = outputHeight / rows;

    // 파형을 자연스럽게 그리기 위한 X축 샘플링 갯수
    const stepsPerLine = 300;
    const stepW = outputWidth / stepsPerLine;

    // 전체 조각의 갯수 구하기
    const totalSegments = rows * stepsPerLine;

    // 변동되지 않는 기초 위치 및 밝기 정보 캐싱
    const sx = new Float32Array(totalSegments);
    const sy = new Float32Array(totalSegments);
    const sd = new Float32Array(totalSegments);

    let n = 0;
    for (let r = 0; r < rows; r++) {
        const cy = r * cellH + cellH / 2;
        const v = rows > 1 ? r / (rows - 1) : 0.5;

        for (let c = 0; c < stepsPerLine; c++) {
            const cx = c * stepW + stepW / 2;
            const u = stepsPerLine > 1 ? c / (stepsPerLine - 1) : 0.5;

            const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
            const darkness = 1 - brightness;

            // 1. Background Skip: 로고가 아닌 검은 여백(darkness 낮은 곳)은 캐싱에서 아예 제외
            // 그릴 가치가 있는 조각(segments)들만 모아서 n을 증가
            if (darkness >= 0.3) {
                sx[n] = cx;
                sy[n] = cy;
                sd[n] = darkness; // 렌더링에 핵심인 명암 정보 보존
                n++;
            }
        }
    }

    return {
        count: n,
        stepsPerLine, stepW,
        sx, sy, sd,
        outputWidth, outputHeight, cellH,
        params: { ...getDefaultParams(), ...params }
    };
}

/**
 * RAF 기반 실시간 애니메이션 렌더링 루프
 */
export function drawFrame(ctx, animState, t) {
    const {
        count, stepsPerLine, stepW,
        sx, sy, sd,
        outputWidth, outputHeight, cellH,
        params
    } = animState;

    const { contrast, pulse, speed, color } = params;

    const minStroke = 0.5; // 실선의 최소 굵기
    const maxStroke = Math.min(contrast, cellH * 1.8); // 뭉개짐(블리딩) 방지 제한값 적용

    // 이전 프레임 클리어
    ctx.clearRect(0, 0, outputWidth, outputHeight);

    ctx.strokeStyle = color;
    ctx.lineCap = 'butt'; // 두께 변화를 각지게 끊기 (가로줄 느낌 향상)

    for (let i = 0; i < count; i++) {
        const x = sx[i];
        const y = sy[i];
        const darkness = sd[i];

        // 이 조각의 X 좌표 비율 (0 ~ 1) - 파동 공식을 위해 역산
        const u = x / outputWidth;

        // Wave Modulation: x축의 일정 비율 위상(pulse) 과 시간별 흐름 속도(speed * t)
        const phase = u * Math.PI * 2 * pulse + (t * speed * 2.0);
        const wave = 0.5 + 0.5 * Math.sin(phase);

        // Math Lerp: 명암과 물결을 곱하여 입체적인 볼륨감 생성
        const weight = lerp(darkness * 0.2, darkness, wave);
        const currentWidth = lerp(minStroke, maxStroke, weight);

        ctx.lineWidth = currentWidth;
        ctx.beginPath();
        ctx.moveTo(x - stepW / 2, y);
        // 빈 틈이 보이지 않게끔 0.5px 가량 넉넉하게 덮어 그어줌
        ctx.lineTo(x + stepW / 2 + 0.5, y);
        ctx.stroke();
    }
}
