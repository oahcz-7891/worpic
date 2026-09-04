/** 纸张尺寸预设 */
export const PAPER_PRESETS = [
  { id: 'a4-300', label: 'A4 纸张 · 300dpi 印刷', width: 2480, height: 3508 },
  { id: 'a4-200', label: 'A4 纸张 · 200dpi 打印', width: 1654, height: 2339 },
  { id: 'a4-96', label: 'A4 纸张 · 96dpi 屏幕', width: 794, height: 1123 },
] as const;

export interface MergeSettings {
  paperId: string;
  width: number;
  height: number;
  rows: number;
  cols: number;
  /** 格子间距(px) */
  gap: number;
  bgColor: string;
  prefix: string;
}

export const DEFAULT_MERGE_SETTINGS: MergeSettings = {
  paperId: 'a4-300',
  width: 2480,
  height: 3508,
  rows: 3,
  cols: 2,
  gap: 0,
  bgColor: '#ffffff',
  prefix: 'merged',
};

export const MAX_MERGE_IMAGES = 99;

/**
 * 将多张图按 rows×cols 合并到指定尺寸的纸上。
 * 每张图等比缩放（contain）居中放入格子，不拉伸变形；最多用 rows×cols 张。
 */
export async function mergeImages(
  images: HTMLImageElement[],
  opts: Pick<MergeSettings, 'width' | 'height' | 'rows' | 'cols' | 'gap' | 'bgColor'>,
): Promise<HTMLCanvasElement> {
  const { width, height, rows, cols, gap, bgColor } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // 背景
  ctx.fillStyle = bgColor || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = (canvas.width - gap * (cols - 1)) / cols;
  const cellH = (canvas.height - gap * (rows - 1)) / rows;
  ctx.imageSmoothingQuality = 'high';

  const total = rows * cols;
  images.slice(0, total).forEach((img, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = c * (cellW + gap);
    const y = r * (cellH + gap);
    // contain：等比缩放，居中
    const s = Math.min(cellW / img.naturalWidth, cellH / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
  });

  return canvas;
}