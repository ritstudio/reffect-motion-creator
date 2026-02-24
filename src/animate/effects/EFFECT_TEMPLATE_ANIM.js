/**
 * EFFECT_TEMPLATE_ANIM.js — Canvas 애니메이션 효과 모듈 템플릿
 *
 * 새 효과를 만들 때 이 파일을 복사하여 사용하세요.
 * 파일명은 `my-effect-anim.js` 형식으로 저장하세요.
 *
 * ───────────── 모듈 인터페이스 (필수) ─────────────
 *   getDefaultParams()  → 기본 파라미터 객체 반환
 *   getParamSchema()    → UI 슬라이더 스키마 배열 반환
 *   init(sampleData, params, width, height) → AnimState 반환
 *   drawFrame(ctx, animState, t) → void  (t: 경과 시간, 초 단위)
 * ─────────────────────────────────────────────────
 *
 * ⚠️  중요: HTML export 직렬화 주의사항
 * init / drawFrame 함수는 .toString()으로 직렬화됩니다.
 * 함수 내부에서 import된 심볼(lerp, mulberry32 등)은
 * EffectPairPanel이 이미 전역에 주입하므로 사용 가능합니다.
 * 단, 새 외부 유틸을 추가한다면 EffectPairPanel.jsx의
 * MATH_UTILS_SRC에도 해당 함수를 추가해야 합니다.
 */

import { lerp, mulberry32, sampleBilinear } from '../../engine/utils/math.js';

// ── 1. 기본 파라미터 ────────────────────────────────────────────────────────
export function getDefaultParams() {
    return {
        count: 100,
        size: 4.0,
        speed: 1.5,    // rad/s — 애니메이션 속도
        seed: 42,     // 랜덤 시드
        color: '#000000',
    };
}

// ── 2. 파라미터 스키마 ─────────────────────────────────────────────────────
export function getParamSchema() {
    return [
        { key: 'count', label: 'Count', min: 10, max: 500, step: 10, default: 100 },
        { key: 'size', label: 'Size', min: 1, max: 20, step: 0.5, default: 4.0 },
        { key: 'speed', label: 'Speed', min: 0.1, max: 5, step: 0.1, default: 1.5 },
    ];
}

// ── 3. 초기화 ─────────────────────────────────────────────────────────────
// 매 파라미터 변경 시 호출됩니다. 무거운 전처리는 여기서 수행하세요.
// 반환 객체(AnimState)는 drawFrame에 그대로 전달됩니다.
export function init(sampleData, params, outputWidth, outputHeight) {
    const { grid, cols: gridCols, rows: gridRows } = sampleData;
    const { count, size, seed, color } = { ...getDefaultParams(), ...params };

    const rand = mulberry32(seed);

    // 예시: 파티클 위치 사전 계산
    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const pr = new Float32Array(count);
    const ph = new Float32Array(count); // 위상 오프셋 (애니메이션용)

    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
        const u = rand();
        const v = rand();
        const brightness = sampleBilinear(grid, gridCols, gridRows, u, v);
        const darkness = 1 - brightness;
        if (darkness < 0.3) continue;

        px[n] = u * outputWidth;
        py[n] = v * outputHeight;
        pr[n] = lerp(1, size, darkness);
        ph[n] = rand() * Math.PI * 2;
        n++;
    }

    return {
        px, py, pr, ph,
        count: n,
        outputWidth,
        outputHeight,
        params: { ...getDefaultParams(), ...params },
    };
}

// ── 4. 프레임 렌더 ────────────────────────────────────────────────────────
// 매 RAF(requestAnimationFrame)마다 호출됩니다.
// t: 경과 시간(초). ctx는 이미 올바른 스케일로 설정되어 있습니다.
// ⚠️  ctx.clearRect()로 이전 프레임을 반드시 지워주세요.
export function drawFrame(ctx, animState, t) {
    const { px, py, pr, ph, count, outputWidth, outputHeight, params } = animState;
    const { speed, color } = params;

    ctx.clearRect(0, 0, outputWidth, outputHeight);
    ctx.fillStyle = color;
    ctx.beginPath();

    for (let i = 0; i < count; i++) {
        const pulse = 0.5 + 0.5 * Math.sin(t * speed + ph[i]);
        const r = lerp(0.5, pr[i], pulse);
        if (r < 0.1) continue;
        ctx.moveTo(px[i] + r, py[i]);
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
    }

    ctx.fill();
}
