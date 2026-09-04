import { useEffect, useMemo, useRef, useState } from 'react';
import type { LibraryImage } from '../types';

interface Props {
  images: LibraryImage[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onImport: (files: File[]) => void;
  onClear: () => void;
}

/** 单张缩略图（负责创建/释放 objectURL） */
function Thumb({
  image, selected, onClick, onDelete,
}: {
  image: LibraryImage;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(image.blob), [image]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div
      className={`lib-item${selected ? ' selected' : ''}`}
      onClick={onClick}
      title={image.name}
    >
      <img src={url} alt={image.name} loading="lazy" />
      <div className="lib-item-meta">
        <span className="lib-item-name">{image.name}</span>
        <span className="lib-item-size">
          {image.width}×{image.height}
        </span>
      </div>
      <button
        className="lib-del"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="删除"
      >
        删除
      </button>
    </div>
  );
}

export default function ImageLibrary({ images, selectedId, onSelect, onDelete, onImport, onClear }: Props) {
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
        <h2>图片库</h2>
        {images.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('确定清空图片库？')) onClear(); }}>
            清空
          </button>
        )}
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

      {images.length === 0 ? (
        <div className="lib-empty">图片库为空，先导入一些图片吧</div>
      ) : (
        <div className="lib-grid">
          {images.map((img) => (
            <Thumb
              key={img.id}
              image={img}
              selected={img.id === selectedId}
              onClick={() => onSelect(img.id)}
              onDelete={() => onDelete(img.id)}
            />
          ))}
        </div>
      )}
    </aside>
  );
}