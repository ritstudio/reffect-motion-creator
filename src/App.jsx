import { useState, useEffect, useCallback } from 'react';


import { sampleSVG } from './engine/svg-sampler.js';

// Generate mode effect modules
import * as verticalLines from './engine/effects/vertical-lines.js';
import * as ellipseGrid from './engine/effects/ellipse-grid.js';
import * as horizontalLines from './engine/effects/horizontal-lines.js';
import * as particleScatter from './engine/effects/particle-scatter.js';
import * as starGlint from './engine/effects/star-glint.js';
import * as lineHalftone from './engine/effects/line-halftone.js';

// Animate mode effect modules
import * as verticalLinesAnim from './animate/effects/vertical-lines-anim.js';
import * as ellipseGridAnim from './animate/effects/ellipse-grid-anim.js';
import * as horizontalLinesAnim from './animate/effects/horizontal-lines-anim.js';
import * as particleScatterAnim from './animate/effects/particle-scatter-anim.js';
import * as starGlintAnim from './animate/effects/star-glint-anim.js';
import * as lineHalftoneAnim from './animate/effects/line-halftone-anim.js';

import SvgUploader from './components/SvgUploader.jsx';
import EffectPairPanel from './components/EffectPairPanel.jsx';
import './styles/app.css';

import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Fixed horizontal resolution for generate mode SVGs.
// outputHeight is derived per-logo from the actual SVG aspect ratio so
// the SVG coordinate space always matches the logo's proportions.
const OUTPUT_W = 1000;

// Effect pairs — generate + animate module for each effect.
// Animate module is the canonical source for the unified param schema.
const effectPairs = [
  { title: 'Particle Scatter', genModule: particleScatter, animModule: particleScatterAnim },
  { title: 'Ellipse Grid', genModule: ellipseGrid, animModule: ellipseGridAnim },
  { title: 'Horizontal Lines', genModule: horizontalLines, animModule: horizontalLinesAnim },
  { title: 'Vertical Lines', genModule: verticalLines, animModule: verticalLinesAnim },
  { title: 'STAR GLINT', genModule: starGlint, animModule: starGlintAnim },
  { title: 'Line Halftone', genModule: lineHalftone, animModule: lineHalftoneAnim },
];

export default function App() {
  const [svgSource, setSvgSource] = useState(null);
  const [logoName, setLogoName] = useState('abc_logo.svg');
  const [sampleData, setSampleData] = useState(null);
  const [mode, setMode] = useState('animate'); // 'generate' | 'animate'
  const [darkMode, setDarkMode] = useState(false);
  const [gridCols, setGridCols] = useState(2);
  const [previewScale, setPreviewScale] = useState(0.8);
  const [showInfo, setShowInfo] = useState(false);

  // Shared params for all effect panels — persists across tab switches.
  // Initialised from animModule (canonical unified schema source).
  const [sharedParams, setSharedParams] = useState(() =>
    effectPairs.map(({ animModule }) => animModule.getDefaultParams())
  );

  // 로컬 개발 중(HMR) 새로운 효과가 배열 끝에 추가되었을 때 기존 state 길이에 맞춰 보정
  useEffect(() => {
    setSharedParams((prev) => {
      if (prev.length === effectPairs.length) return prev;
      const next = [...prev];
      for (let i = prev.length; i < effectPairs.length; i++) {
        next[i] = effectPairs[i].animModule.getDefaultParams();
      }
      return next;
    });
  }, []);

  // Load default logo on mount
  useEffect(() => {
    fetch('/abc_logo.svg')
      .then((r) => r.text())
      .then((text) => setSvgSource(text))
      .catch(console.error);
  }, []);

  // Re-sample whenever the SVG source changes (aspect-correct, 300 cols)
  useEffect(() => {
    if (!svgSource) {
      setSampleData(null);
      return;
    }
    let cancelled = false;
    sampleSVG(svgSource, 300).then((data) => {
      if (!cancelled) setSampleData(data);
    });
    return () => { cancelled = true; };
  }, [svgSource]);

  // Apply dark/light theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Close info modal on Escape
  useEffect(() => {
    if (!showInfo) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowInfo(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInfo]);

  // Sync preview scale CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--preview-scale', previewScale);
  }, [previewScale]);

  function handleSvgLoaded(text, name) {
    setSvgSource(text);
    setLogoName(name);
  }

  function handleClearLogo() {
    setSvgSource(null);
    setSampleData(null);
    setLogoName('No logo');
  }

  // Param change handler — updates only the specific effect's params
  const handleParamChange = useCallback((effectIdx, key, value) => {
    setSharedParams((prev) => {
      const next = [...prev];
      next[effectIdx] = { ...next[effectIdx], [key]: value };
      return next;
    });
  }, []);

  // Compute SVG output dimensions that match the logo's true aspect ratio.
  // FILMER (1075×221, 4.86:1) → outputWidth=1000, outputHeight=206
  const outputWidth = OUTPUT_W;
  const outputHeight = sampleData
    ? Math.max(1, Math.round(OUTPUT_W / (sampleData.svgWidth / sampleData.svgHeight)))
    : OUTPUT_W;

  function startTour() {
    const driverObj = driver({
      showProgress: false,
      nextBtnText: '다음',
      prevBtnText: '이전',
      doneBtnText: '완료',
      animate: true,
      smoothScroll: true,
      allowClose: true,
      steps: [
        {
          element: '.upload-zone.upload-combined',
          popover: {
            title: 'Step 1. 로고 업로드 (Upload)',
            description: '작업할 SVG 로고 파일을 끌어다 놓으세요.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '.mode-toggle',
          popover: {
            title: 'Step 2. 모드 전환 (Preview Mode)',
            description: 'Static(이미지) / Motion(애니메이션)이 적용된 모습을 실시간으로 비교하세요.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '.effect-panel:first-of-type .control-item:first-of-type input[type="range"]',
          popover: {
            title: 'Step 3. 세부 조절 (Adjust)',
            description: '슬라이더를 좌우로 움직여 내가 원하는 느낌으로 맞춰보세요.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '.view-settings-group',
          popover: {
            title: 'Step 4. 뷰어 설정 (View Settings)',
            description: '화면 크기, 보기 방식, 다크/라이트 테마를 내 작업 환경에 맞게 변경해 보세요.',
            side: 'bottom',
            align: 'end'
          }
        },
        {
          element: '.effect-panel:first-of-type .panel-header .export-buttons',
          popover: {
            title: 'Step 5. 내보내기 (Export)',
            description: '완성된 결과물을 이미지(SVG) / 애니메이션(Code/GIF/MP4)로 다운로드하세요.',
            side: 'bottom',
            align: 'end'
          }
        }
      ]
    });
    driverObj.drive();
  }

  return (
    <>
      <div className="top-controls">
        <div className="top-controls-left">
          <SvgUploader
            currentName={logoName}
            svgSource={svgSource}
            onSvgLoaded={handleSvgLoaded}
            onClear={handleClearLogo}
          />
        </div>
        <div className="top-controls-center">
          <div className="mode-toggle">
            <div
              className="mode-toggle-pill"
              style={{ transform: `translateX(${mode === 'animate' ? '100%' : '0%'})` }}
            />
            <button
              className={`mode-btn${mode === 'generate' ? ' active' : ''}`}
              onClick={() => setMode('generate')}
            >
              Static
            </button>
            <button
              className={`mode-btn${mode === 'animate' ? ' active' : ''}`}
              onClick={() => setMode('animate')}
            >
              Motion
            </button>
          </div>
        </div>
        <div className="top-controls-right">
          <div className="view-settings-group">
            <div className="size-slider-wrap">
              <span className="size-slider-label-sm">A</span>
              <input
                type="range"
                className="size-slider-input"
                min="0.4"
                max="1"
                step="0.01"
                value={previewScale}
                onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                title={`Logo size: ${Math.round(previewScale * 100)}%`}
              />
              <span className="size-slider-label-lg">A</span>
            </div>
            <div className="view-toggle" title="Grid columns">
              <div
                className="view-toggle-pill"
                style={{ transform: `translateX(${gridCols === 2 ? '100%' : '0%'})` }}
              />
              <button
                className={`view-btn${gridCols === 1 ? ' active' : ''}`}
                onClick={() => setGridCols(1)}
                title="List view"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="0" y="0" width="14" height="4" rx="1" />
                  <rect x="0" y="5" width="14" height="4" rx="1" />
                  <rect x="0" y="10" width="14" height="4" rx="1" />
                </svg>
              </button>
              <button
                className={`view-btn${gridCols === 2 ? ' active' : ''}`}
                onClick={() => setGridCols(2)}
                title="Grid view"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6" rx="1" />
                  <rect x="8" y="0" width="6" height="6" rx="1" />
                  <rect x="0" y="8" width="6" height="6" rx="1" />
                  <rect x="8" y="8" width="6" height="6" rx="1" />
                </svg>
              </button>
            </div>
            <div className="view-toggle" title="Theme">
              <div
                className="view-toggle-pill"
                style={{ transform: `translateX(${darkMode ? '100%' : '0%'})` }}
              />
              <button
                className={`view-btn${!darkMode ? ' active' : ''}`}
                onClick={() => setDarkMode(false)}
                title="Light mode"
              >
                {/* Sun icon */}
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12.95" y1="3.05" x2="11.54" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="4.46" y1="11.54" x2="3.05" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className={`view-btn${darkMode ? ' active' : ''}`}
                onClick={() => setDarkMode(true)}
                title="Dark mode"
              >
                {/* Moon icon */}
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M11.5 9A5.5 5.5 0 0 1 5 2.5a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* panel grid — layout controlled by gridCols state */}
      <div className={`effects-grid${gridCols === 1 ? ' single-col' : ''}`}>
        {effectPairs.map((pair, idx) => (
          <EffectPairPanel
            key={pair.title}
            mode={mode}
            title={pair.title}
            sampleData={sampleData}
            genModule={pair.genModule}
            animModule={pair.animModule}
            outputWidth={outputWidth}
            outputHeight={outputHeight}
            params={sharedParams[idx]}
            onParamChange={(key, value) => handleParamChange(idx, key, value)}
            logoName={logoName}
          />
        ))}
      </div>

      {/* ── Floating info button ── */}
      <button className="info-fab" onClick={() => setShowInfo(true)} title="About">
        <img src="/favicon-rit.svg" alt="Info" />
      </button>

      {/* ── Info modal ── */}
      {showInfo && (
        <div className="info-overlay" onClick={() => setShowInfo(false)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <button className="info-modal-close" onClick={() => setShowInfo(false)}>×</button>

            <h2 className="info-modal-title">effect - Motion Creator</h2>
            <p className="info-modal-tagline">현재 베타 버전입니다. 추후에 이펙트가 추가될 예정입니다.</p>

            <section className="info-section">
              <h3>Effects</h3>
              <ul>
                <li><strong>Particle Scatter</strong> — 로고 형태를 따라 흩어지는 파티클</li>
                <li><strong>Ellipse Grid</strong> — 격자 형태의 타원이 펄스 애니메이션</li>
                <li><strong>Horizontal Lines</strong> — 굵기가 변하는 수평 라인 웨이브</li>
                <li><strong>Vertical Lines</strong> — 굵기가 변하는 수직 라인 웨이브</li>
                <li><strong>Star Glint</strong> — 로고를 구성하며 반짝이는 다이내믹 십자별</li>
                <li><strong>Line Halftone</strong> — 두께로 명암 볼륨감을 표현하는 가로줄 웨이브</li>
              </ul>
            </section>

            <div className="tutorial-btn-wrapper">
              <button
                className="tutorial-start-btn"
                onClick={() => { setShowInfo(false); setTimeout(() => startTour(), 300); }}
              >
                사용법 알아보기
              </button>
            </div>

            <footer className="info-modal-footer">
              Created by <a href="https://www.ritstudio.kr" target="_blank" rel="noreferrer">RIT STUDIO®</a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
