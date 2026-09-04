import { useEffect, useMemo, useRef, useState } from 'react';
import type { LibraryImage } from '../types';

interface Props {
  images: LibraryImage[];
  /** 勾选顺序（决定拼图顺序） */
  selectedIds: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRemove: (id: number) => void;
  onMove: (id: number, dir: -1 | 1) => void;
  onImport: (files: File[]) => void;
  /** 清空图片库（IndexedDB） */
  onClearLibrary: () => void;
}

/** 缩略图（创建/释放 objectURL） */
function Thumb({ blob, className }: { blob: Blob; className: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className={className} src={url} alt="" loading="lazy" draggable={false} />;
}

export default function MergePicker({ images, selectedIds, onToggle, onSelectAll, onClearAll, onRemove, onMove, onImport, onClearLibrary }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (list && list.length) onImport(Array.from(list));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <aside className="panel-library">
      <div className="panel-title-row">
        <h2>选择图片</h2>
        <button className="btn btn-ghost btn-sm" onClick={onSelectAll}>全选</button>
        <button className="btn btn-ghost btn-sm" onClick={onClearAll}>取消全选</button>
        <button className="btn btn-ghost btn-sm" onClick={onClearLibrary}>清空图库</button>
      </div>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <span>点击选择或拖入图片批量导入</span>
        <span className="dropzone-hint">支持 jpg / png / webp / gif / bmp 等</span>
      </div>

      <div className="merge-pick-list">
        {images.length === 0 && <div className="lib-empty">图片库为空，请先导入图片</div>}
        {images.map((img) => (
          <div
            key={img.id}
            className={`merge-pick-item${selectedIds.includes(img.id) ? ' checked' : ''}`}
            onClick={() => onToggle(img.id)}
            title={img.name}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(img.id)}
              readOnly
              tabIndex={-1}
            />
            <Thumb blob={img.blob} className="merge-pick-thumb" />
            <span className="merge-pick-name">{img.name}</span>
            <span className="merge-pick-size">
              {img.width}×{img.height}
            </span>
          </div>
        ))}
      </div>

      <div className="panel-title-row seq-title">
        <h2>合并顺序</h2>
        <span className="crop-info">{selectedIds.length} 张</span>
        <button className="btn btn-ghost btn-sm" onClick={onClearAll} style={{ marginLeft: 'auto' }}>
          清空
        </button>
      </div>

      {selectedIds.length === 0 ? (
        <div className="lib-empty">勾选图片后按此顺序拼图</div>
      ) : (
        <div className="seq-list">
          {selectedIds.map((id, idx) => {
            const img = images.find((i) => i.id === id);
            if (!img) return null;
            return (
              <div className="seq-item" key={id}>
                <span className="seq-no">{idx + 1}</span>
                <Thumb blob={img.blob} className="seq-thumb" />
                <span className="seq-name">{img.name}</span>
                <button
                  className="seq-btn"
                  disabled={idx === 0}
                  onClick={() => onMove(id, -1)}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  className="seq-btn"
                  disabled={idx === selectedIds.length - 1}
                  onClick={() => onMove(id, 1)}
                  title="下移"
                >
                  ↓
                </button>
                <button className="seq-btn seq-remove" onClick={() => onRemove(id)} title="移除">
                  移除
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}