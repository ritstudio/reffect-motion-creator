import AnimatedPanel from './AnimatedPanel.jsx';
import * as verticalLinesAnim   from './effects/vertical-lines-anim.js';
import * as ellipseGridAnim     from './effects/ellipse-grid-anim.js';
import * as horizontalLinesAnim from './effects/horizontal-lines-anim.js';
import * as particleScatterAnim from './effects/particle-scatter-anim.js';

const animEffects = [
  { title: 'Vertical Lines',   module: verticalLinesAnim   },
  { title: 'Ellipse Grid',     module: ellipseGridAnim     },
  { title: 'Horizontal Lines', module: horizontalLinesAnim },
  { title: 'Particle Scatter', module: particleScatterAnim },
];

/**
 * 4개의 애니메이션 패널을 2×2 그리드로 표시.
 * Generate 모드와 동일한 `.effects-grid` CSS 재사용.
 * 각 패널은 독립적인 파라미터 슬라이더 + Export 기능을 가짐.
 */
export default function AnimationViewer({ sampleData }) {
  if (!sampleData) {
    return <div className="loading-msg">로고를 로딩 중입니다…</div>;
  }

  return (
    <div className="effects-grid">
      {animEffects.map((eff) => (
        <AnimatedPanel
          key={eff.title}
          title={eff.title}
          sampleData={sampleData}
          effectModule={eff.module}
        />
      ))}
    </div>
  );
}
