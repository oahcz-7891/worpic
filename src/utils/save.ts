import type { OutputFormat } from '../types';

const COUNTER_KEY = 'worpic-export-counter';

/** 当前导出序号（不递增） */
export function getCounter(): number {
  return Number(localStorage.getItem(COUNTER_KEY) || '0');
}

/** 取下一个导出序号并递增持久化 */
export function nextCounter(): number {
  const n = getCounter() + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return n;
}

export function resetCounter(): void {
  localStorage.removeItem(COUNTER_KEY);
}

/** 取文件名（去掉扩展名），如 photo.jpg → photo */
export function baseName(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/** 生成文件名，如 product_001.png */
export function buildFileName(prefix: string, counter: number, format: OutputFormat): string {
  const clean = prefix.trim() || 'image';
  return `${clean}_${String(counter).padStart(3, '0')}.${format}`;
}

export function supportsDirectoryPicker(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** 弹出目录选择框，返回可读写的目录句柄 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  return (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker({ mode: 'readwrite' });
}

/** 写入文件到指定目录 */
export async function saveBlobToDirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** 回退方案：触发浏览器下载 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}