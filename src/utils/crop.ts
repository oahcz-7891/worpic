import type { CropAreaPixels, ExportSettings, OutputFormat } from '../types';

/** 将 Blob 加载为 HTMLImageElement */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))),
      mime,
      quality,
    );
  });
}

/**
 * 按目标尺寸精确裁剪导出。
 * 以裁剪区域（原图坐标）为源，绘制到目标宽高的画布上。
 */
export async function cropToBlob(
  img: HTMLImageElement,
  area: CropAreaPixels,
  settings: ExportSettings,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // jpg 无透明通道，需要铺背景色
  if (settings.format === 'jpg') {
    ctx.fillStyle = settings.bgColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToBlob(canvas, settings.format, settings.quality);
}