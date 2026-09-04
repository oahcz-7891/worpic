/** 图片库中的一张图片 */
export interface LibraryImage {
  id: number;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  addedAt: number;
}

export type OutputFormat = 'png' | 'jpg' | 'webp';

/** 导出设置 */
export interface ExportSettings {
  /** 目标宽度(px) */
  width: number;
  /** 目标高度(px) */
  height: number;
  format: OutputFormat;
  /** jpg/webp 质量 0~1 */
  quality: number;
  /** 文件名前缀 */
  prefix: string;
  /** jpg 背景色（jpg 无透明通道） */
  bgColor: string;
}

/** 裁剪区域（相对原图像素坐标） */
export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}