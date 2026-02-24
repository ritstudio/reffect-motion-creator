/**
 * EFFECT_TEMPLATE.js — Static SVG 효과 모듈 템플릿
 *
 * 새 효과를 만들 때 이 파일을 복사하여 사용하세요.
 * 파일명은 `my-effect.js` 형식으로 저장하세요.
 *
 * ───────────── 추가 방법 ─────────────
 * 1. 이 파일을 `src/engine/effects/my-effect.js` 로 복사
 * 2. `src/animate/effects/my-effect-anim.js` 도 생성 (EFFECT_TEMPLATE_ANIM.js 참고)
 * 3. App.jsx 상단에 두 모듈을 import
 * 4. App.jsx의 effectPairs 배열에 아래 한 줄 추가:
 *    { title: 'My Effect', genModule: myEffect, animModule: myEffectAnim }
 * ─────────────────────────────────────
 */

import { lerp, sampleBilinear } from '../utils/math.js';

// ── 1. 기본 파라미터 ────────────────────────────────────────────────────────
// getDefaultParams()는 generate와 animate 모듈이 동일한 키/기본값을 공유합니다.
// animate-only 파라미터(speed, waveFreq 등)도 여기에 포함하세요.
export function getDefaultParams() {
    return {
        // 예시 파라미터 — 실제 효과에 맞게 수정하세요
        count: 100,
        size: 4.0,
        speed: 1.5,   // animate-only (generate에서는 무시됨)
        color: '#000000',
    };
}

// ── 2. 파라미터 스키마 ─────────────────────────────────────────────────────
// UI 슬라이더에 표시될 파라미터 목록입니다.
// animate-only 파라미터에는 key 이름을 App.jsx의 motionOnlyKeys Set에 추가하면
// Static 탭에서 자동으로 숨겨집니다.
export function getParamSchema() {
    return [
        { key: 'count', label: 'Count', min: 10, max: 500, step: 10, default: 100 },
        { key: 'size', label: 'Size', min: 1, max: 20, step: 0.5, default: 4.0 },
        { key: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 1.5 },
    ];
}

// ── 3. SVG 생성 함수 ───────────────────────────────────────────────────────
// sampleData.grid: 2D 배열 (0=검정, 1=흰색), 로고의 픽셀 밝기 맵
// params: 현재 파라미터 값 (getDefaultParams 기본값과 병합됨)
// outputWidth / outputHeight: SVG 좌표계 크기 (기본 1000px 기준)
// 반환값: SVG 문자열
export function generate(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { count, size, color } = { ...getDefaultParams(), ...params };

    let elements = '';

    for (let i = 0; i < count; i++) {
        // 예시: 랜덤 위치에 원 배치 (실제 효과 로직으로 교체하세요)
        const u = Math.random();
        const v = Math.random();
        const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
        const darkness = 1 - brightness;
        if (darkness < 0.3) continue;

        const x = u * outputWidth;
        const y = v * outputHeight;
        const r = lerp(1, size, darkness);
        elements += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" />`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <g fill="${color}">${elements}</g>
</svg>`;
}
