import { useState, useEffect } from 'react';

export default function ParamSlider({ schema, value, onChange }) {
  const [isDragging, setIsDragging] = useState(false);

  // Global listener — catches pointerup/cancel even when released outside the input
  useEffect(() => {
    if (!isDragging) return;
    const stop = () => setIsDragging(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [isDragging]);

  const displayValue =
    schema.step < 1 ? value.toFixed(2) : String(Math.round(value));

  const percent = ((value - schema.min) / (schema.max - schema.min)) * 100;
  // thumb(8px) 크기 보정: 0% → 0px 보정, 100% → -8px 보정
  const bubbleLeft = `calc(${percent}% - ${percent * 0.08}px)`;

  return (
    <div className="control-item">
      <label>{schema.label}</label>
      <div className="range-wrap">
        {isDragging && (
          <span className="range-bubble" style={{ left: bubbleLeft }}>
            {displayValue}
          </span>
        )}
        <input
          type="range"
          min={schema.min}
          max={schema.max}
          step={schema.step}
          value={value}
          onChange={(e) => onChange(schema.key, parseFloat(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
        />
      </div>
    </div>
  );
}
