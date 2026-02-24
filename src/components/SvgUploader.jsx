import { useState, useRef, useMemo } from 'react';

export default function SvgUploader({ currentName, svgSource, onSvgLoaded, onClear }) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef(null);
  const thumbnailSrc = useMemo(() => {
    if (!svgSource) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`;
  }, [svgSource]);

  function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.svg')) return;
    const reader = new FileReader();
    reader.onload = (e) => onSvgLoaded(e.target.result, file.name);
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragover(true);
  }

  function onDragLeave() {
    setDragover(false);
  }

  function onClick() {
    inputRef.current?.click();
  }

  function onFileChange(e) {
    handleFile(e.target.files[0]);
  }

  function onClearClick(e) {
    e.stopPropagation();
    onClear?.();
    if (inputRef.current) inputRef.current.value = '';
  }

  function onUploadTextClick(e) {
    e.stopPropagation();
    inputRef.current?.click();
  }

  return (
    <div className="upload-bar">
      <div
        className={`upload-zone upload-combined ${dragover ? 'dragover' : ''}`}
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="upload-current">
          <button
            type="button"
            className="upload-replace-text"
            onClick={onUploadTextClick}
            aria-label="Upload logo"
            title="Upload"
          >
            UPLOAD SVG LOGO
          </button>
          {thumbnailSrc && (
            <div className="logo-thumb-wrap">
              <img
                className="logo-thumb"
                src={thumbnailSrc}
                alt="Logo thumbnail"
                title={currentName || 'Current logo'}
              />
              <button
                type="button"
                className="logo-remove-btn"
                onClick={onClearClick}
                aria-label="Remove logo"
                title="Remove"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".svg"
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}
