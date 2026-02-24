import { useState, useMemo, useCallback } from 'react';
import ParamSlider from './ParamSlider.jsx';

export default function EffectPanel({
  title,
  sampleData,
  effectModule,
  outputWidth,
  outputHeight,
}) {
  const schema = useMemo(() => effectModule.getParamSchema(), [effectModule]);
  const defaults = useMemo(() => effectModule.getDefaultParams(), [effectModule]);
  const [params, setParams] = useState(defaults);
  const [collapsed, setCollapsed] = useState(false);

  const handleParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const svgString = useMemo(() => {
    if (!sampleData) return null;
    return effectModule.generate(sampleData, params, outputWidth, outputHeight);
  }, [sampleData, params, outputWidth, outputHeight, effectModule]);

  function downloadSVG() {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="effect-panel">
      <div className="panel-header">
        <span>
          {title}
          <button
            className="toggle-controls"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? '+ params' : '- params'}
          </button>
        </span>
        <button onClick={downloadSVG}>Export SVG</button>
      </div>

      <div className="panel-preview">
        {svgString ? (
          <div dangerouslySetInnerHTML={{ __html: svgString }} />
        ) : (
          <span className="loading">Waiting for logo...</span>
        )}
      </div>

      <div className={`panel-controls ${collapsed ? 'collapsed' : ''}`}>
        {schema.map((s) => (
          <ParamSlider
            key={s.key}
            schema={s}
            value={params[s.key]}
            onChange={handleParam}
          />
        ))}
      </div>
    </div>
  );
}
