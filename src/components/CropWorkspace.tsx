import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CropAreaPixels, LibraryImage } from '../types';

interface Props {
  image: LibraryImage | null;
  /** 目标裁剪宽(px) */
  width: number;
  /** 目标裁剪高(px) */
  height: number;
  onCropAreaChange: (area: CropAreaPixels | null) => void;
}

/** 裁剪框（屏幕坐标，百分比缩放时保持固定） */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 图片显示布局 */
interface Layout {
  scale: number;
  dw: number;
  dh: number;
  ox: number;
  oy: number;
}

type ResizeMode = 'nw' | 'ne' | 'sw' | 'se';

const MIN_BOX = 20; // 裁剪框最小屏幕尺寸(px)

/** 缩放范围（百分比，100 = 图片完整显示，<100 为缩小显示） */
const MIN_ZOOM = 20;
const MAX_ZOOM = 800;
const ZOOM_STEP = 10;
/** 默认/复位缩放值 */
const DEFAULT_ZOOM = 100;

function clampZoom(v: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 拖动角调整大小：屏幕坐标、锚点固定、保持目标比例、限制在图片显示区内 */
function resizeBox(sb: Box, mode: ResizeMode, dx: number, dy: number, l: Layout, aspect: number): Box {
  const anchorX = mode.includes('w') ? sb.x + sb.width : sb.x;
  const anchorY = mode.includes('n') ? sb.y + sb.height : sb.y;
  const moveX = (mode.includes('e') ? sb.x + sb.width : sb.x) + dx;
  const moveY = (mode.includes('s') ? sb.y + sb.height : sb.y) + dy;
  const rw = Math.abs(moveX - anchorX);
  const rh = Math.abs(moveY - anchorY);
  let w = Math.min(rw, rh * aspect);
  let h = w / aspect;
  w = Math.max(w, MIN_BOX);
  h = w / aspect;
  const maxW = mode.includes('e') ? l.ox + l.dw - anchorX : anchorX - l.ox;
  const maxH = mode.includes('s') ? l.oy + l.dh - anchorY : anchorY - l.oy;
  w = Math.min(w, maxW, maxH * aspect);
  h = w / aspect;
  const x = clamp(moveX >= anchorX ? anchorX : anchorX - w, l.ox, l.ox + l.dw - w);
  const y = clamp(moveY >= anchorY ? anchorY : anchorY - h, l.oy, l.oy + l.dh - h);
  return { x, y, width: w, height: h };
}

export default function CropWorkspace({ image, width, height, onCropAreaChange }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [cropping, setCropping] = useState(false);
  /** 裁剪框（屏幕坐标，缩放时固定不变） */
  const [box, setBox] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const dragRef = useRef<{ mode: 'move' | ResizeMode; startX: number; startY: number; startBox: Box } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [zoomPct, setZoomPct] = useState(DEFAULT_ZOOM);

  const url = useMemo(() => (image ? URL.createObjectURL(image.blob) : null), [image]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // 测量裁剪区尺寸
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 切换图片或改目标尺寸时重置
  useEffect(() => {
    setCropping(false);
    setBox(null);
    boxRef.current = null;
    onCropAreaChange(null);
    setZoomPct(DEFAULT_ZOOM);
  }, [image?.id, width, height, onCropAreaChange]);

  const aspect = width > 0 && height > 0 ? width / height : 1;

  /** 图片显示布局（含缩放；图片放大后与裁剪区中心对齐） */
  const layout = useMemo<Layout | null>(() => {
    if (!image || !stageSize.w || !stageSize.h) return null;
    const baseScale = Math.min(stageSize.w / image.width, stageSize.h / image.height);
    const scale = baseScale * (zoomPct / 100);
    const dw = image.width * scale;
    const dh = image.height * scale;
    return { scale, dw, dh, ox: (stageSize.w - dw) / 2, oy: (stageSize.h - dh) / 2 };
  }, [image, stageSize, zoomPct]);

  /** 生成初始裁剪框：目标像素对应截图区居中（目标大于图片时等比缩小到图片恰好容纳） */
  const generateInitialBox = useCallback((): Box | null => {
    if (!image || !stageSize.w || !stageSize.h) return null;
    const baseScale = Math.min(stageSize.w / image.width, stageSize.h / image.height);
    const fit = Math.min(1, image.width / width, image.height / height);
    const w = width * baseScale * fit;
    const h = height * baseScale * fit;
    return { x: (stageSize.w - w) / 2, y: (stageSize.h - h) / 2, width: w, height: h };
  }, [image, stageSize, width, height]);

  /** 屏幕框 → 原图裁剪区域（导出用） */
  const rectFromBox = useCallback((b: Box, l: Layout): CropAreaPixels => ({
    x: (b.x - l.ox) / l.scale,
    y: (b.y - l.oy) / l.scale,
    width: b.width / l.scale,
    height: b.height / l.scale,
  }), []);

  const applyBox = useCallback((b: Box, l: Layout) => {
    setBox(b);
    boxRef.current = b;
    const r = rectFromBox(b, l);
    onCropAreaChange({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  }, [rectFromBox, onCropAreaChange]);

  // 缩放变化后，保证裁剪框仍在图片显示区内（若图片显示区小于框则等比缩小框）
  useEffect(() => {
    if (!layout || !box) return;
    const s = Math.min(1, layout.dw / box.width, layout.dh / box.height);
    const w = s < 1 ? box.width * s : box.width;
    const h = s < 1 ? box.height * s : box.height;
    const x = clamp(box.x, layout.ox, layout.ox + layout.dw - w);
    const y = clamp(box.y, layout.oy, layout.oy + layout.dh - h);
    if (x !== box.x || y !== box.y || w !== box.width || h !== box.height) {
      applyBox({ x, y, width: w, height: h }, layout);
    }
  }, [layout, box, applyBox]);

  const handleCropClick = () => {
    if (!image) return;
    if (cropping) {
      setCropping(false);
      setBox(null);
      boxRef.current = null;
      onCropAreaChange(null);
      return;
    }
    const b = generateInitialBox();
    if (!b || !layout) return;
    setCropping(true);
    applyBox(b, layout);
  };

  const handleReset = () => {
    const b = generateInitialBox();
    if (!b || !layout) return;
    applyBox(b, layout);
  };

  // ---------- 指针拖动：移动/缩放裁剪框（屏幕坐标） ----------
  const onPointerDown = (e: React.PointerEvent, mode: 'move' | ResizeMode) => {
    if (!layout || !boxRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...boxRef.current },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !layout || !boxRef.current) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const sb = d.startBox;
    const next: Box = d.mode === 'move'
      ? {
          x: clamp(sb.x + dx, layout.ox, layout.ox + layout.dw - sb.width),
          y: clamp(sb.y + dy, layout.oy, layout.oy + layout.dh - sb.height),
          width: sb.width,
          height: sb.height,
        }
      : resizeBox(sb, d.mode, dx, dy, layout, aspect);
    applyBox(next, layout);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="crop-workspace">
      <div className="panel-title-row">
        <h2>裁剪</h2>
        {image && (
          <span className="crop-info">
            原图 {image.width}×{image.height} · 目标 {width}×{height}
          </span>
        )}
        <div className="crop-actions">
          {image && (
            <button className="btn btn-primary btn-sm" onClick={handleCropClick}>
              {cropping ? '取消裁剪' : '裁剪'}
            </button>
          )}
          {cropping && (
            <button className="btn btn-ghost btn-sm" onClick={handleReset}>
              重置裁剪框
            </button>
          )}
        </div>
      </div>

      <div className="crop-stage" ref={stageRef}>
        {image && url ? (
          <div
            className="crop-media"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img
              className="crop-preview"
              src={url}
              alt={image.name}
              draggable={false}
              style={
                layout
                  ? { width: layout.dw, height: layout.dh, left: layout.ox, top: layout.oy }
                  : undefined
              }
            />
            {cropping && box && layout && (
              <>
                {/* 遮罩：框外压暗 */}
                <div className="crop-shade" style={{ left: 0, top: 0, width: stageSize.w, height: box.y }} />
                <div className="crop-shade" style={{ left: 0, top: box.y + box.height, width: stageSize.w, height: stageSize.h - box.y - box.height }} />
                <div className="crop-shade" style={{ left: 0, top: box.y, width: box.x, height: box.height }} />
                <div className="crop-shade" style={{ left: box.x + box.width, top: box.y, width: stageSize.w - box.x - box.width, height: box.height }} />
                {/* 裁剪框本体 */}
                <div
                  className="crop-box"
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                  onPointerDown={(e) => onPointerDown(e, 'move')}
                />
                {/* 四角调整手柄 */}
                {(['nw', 'ne', 'sw', 'se'] as ResizeMode[]).map((h) => (
                  <div
                    key={h}
                    className={`crop-handle ${h}`}
                    onPointerDown={(e) => onPointerDown(e, h)}
                  />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="crop-empty">请先在左侧图片库选择一张图片</div>
        )}
      </div>

      {image && (
        <div className="zoom-row">
          <span>缩放</span>
          <button
            className="zoom-btn"
            onClick={() => setZoomPct(clampZoom(zoomPct - ZOOM_STEP))}
            title="缩小"
          >
            −
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoomPct}
            onChange={(e) => setZoomPct(Number(e.target.value))}
          />
          <button
            className="zoom-btn"
            onClick={() => setZoomPct(clampZoom(zoomPct + ZOOM_STEP))}
            title="放大"
          >
            +
          </button>
          <input
            className="zoom-input"
            type="number"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            value={zoomPct}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) setZoomPct(clampZoom(Math.round(n)));
            }}
          />
          <span>%</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setZoomPct(DEFAULT_ZOOM)}
          >
            复位
          </button>
        </div>
      )}

      {image && !cropping && (
        <div className="crop-tip">点击上方「裁剪」按钮，生成 {width}×{height} 的裁剪框</div>
      )}
      {image && cropping && (
        <div className="crop-tip">
          拖动裁剪框移动位置、四角调整大小（锁定 {width}×{height} 比例）；缩放仅放大图片，裁剪框大小不变
        </div>
      )}
    </div>
  );
}