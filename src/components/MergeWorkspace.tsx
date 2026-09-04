import { useCallback, useEffect, useState } from 'react';
import MergePicker from './MergePicker';
import MergeSettings from './MergeSettings';
import type { LibraryImage } from '../types';
import { loadImageFromBlob } from '../utils/crop';
import { DEFAULT_MERGE_SETTINGS, mergeImagesPaginated, type MergeSettings as MergeSettingsType } from '../utils/merge';
import { buildFileName, downloadBlob, saveBlobToDirectory } from '../utils/save';

interface Props {
  images: LibraryImage[];
  dirHandle: FileSystemDirectoryHandle | null;
  dirName: string | null;
  onPickDir: () => void;
  onClearDir: () => void;
  onImport: (files: File[]) => void;
  /** 清空图片库（IndexedDB） */
  onClearLibrary: () => void;
}

export default function MergeWorkspace({ images, dirHandle, dirName, onPickDir, onClearDir, onImport, onClearLibrary }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [settings, setSettings] = useState<MergeSettingsType>(DEFAULT_MERGE_SETTINGS);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  /** 合并结果页（每页一张纸） */
  const [pages, setPages] = useState<HTMLCanvasElement[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(images.map((i) => i.id));
  }, [images]);

  const clearAll = useCallback(() => setSelectedIds([]), []);

  /** 清空图片库：确认后清空 IndexedDB，并清空当前勾选 */
  const handleClearLibrary = useCallback(() => {
    if (!window.confirm('确定清空图片库？')) return;
    onClearLibrary();
    setSelectedIds([]);
  }, [onClearLibrary]);

  const remove = useCallback((id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const move = useCallback((id: number, dir: -1 | 1) => {
    setSelectedIds((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  /** 自动合并：勾选图片按行列分页合成到纸张，支持多页 */
  const handleMerge = async () => {
    if (!selectedIds.length) return;
    setMerging(true);
    setStatus('');
    try {
      const used = selectedIds
        .map((id) => images.find((i) => i.id === id))
        .filter((i): i is LibraryImage => Boolean(i));
      const imgs = await Promise.all(used.map((i) => loadImageFromBlob(i.blob)));
      const result = await mergeImagesPaginated(imgs, settings);
      setPages(result);
      setPageIndex(0);
      setMerged(true);
      setStatus(`已合并 ${used.length} 张图片，共 ${result.length} 页`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`合并失败：${msg}`);
      window.alert(`合并失败：${msg}`);
    } finally {
      setMerging(false);
    }
  };

  // 当前翻页对应的预览图
  useEffect(() => {
    if (!pages || pages.length === 0) {
      setPreviewUrl(null);
      return;
    }
    const idx = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setPreviewUrl(pages[idx].toDataURL('image/png'));
  }, [pages, pageIndex]);

  const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/png');
    });

  /** 保存所有页：每页一个文件，序号从 _001 独立开始 */
  const handleSave = async () => {
    if (!pages || pages.length === 0) return;
    setSaving(true);
    try {
      const names: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const blob = await canvasToPng(pages[i]);
        const name = buildFileName(settings.prefix, i + 1, 'png');
        names.push(name);
        if (dirHandle) {
          await saveBlobToDirectory(dirHandle, name, blob);
        } else {
          downloadBlob(blob, name);
        }
      }
      const dirText = dirHandle ? ` → ${dirName}` : '（未选择文件夹，已下载）';
      setStatus(`已保存 ${pages.length} 页：${names.join('、')}${dirText}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`保存失败：${msg}`);
      window.alert(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const nextFileName = buildFileName(settings.prefix, 1, 'png');
  const perPage = settings.rows * settings.cols;

  return (
    <>
      <MergePicker
        images={images}
        selectedIds={selectedIds}
        onToggle={toggle}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        onRemove={remove}
        onMove={move}
        onImport={onImport}
        onClearLibrary={handleClearLibrary}
      />

      <div className="merge-center">
        <div className="panel-title-row">
          <h2>合并预览</h2>
          <span className="crop-info">
            纸张 {settings.width}×{settings.height}px · 每页 {settings.rows}×{settings.cols} 张
          </span>
        </div>
        <div className="merge-stage">
          {previewUrl ? (
            <img className="merge-preview" src={previewUrl} alt="合并结果预览" />
          ) : (
            <div className="merge-empty">
              {selectedIds.length ? '点击右侧「自动合并」生成预览' : '勾选图片后可点击「自动合并」'}
            </div>
          )}
        </div>
        {pages && pages.length > 0 && (
          <div className="pager-row">
            <button
              className="btn btn-sm"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(pageIndex - 1)}
            >
              上一页
            </button>
            <span className="crop-info">
              第 {pageIndex + 1} / {pages.length} 页 · 共 {selectedIds.length} 张{selectedIds.length > perPage ? `（自动分页）` : ''}
            </span>
            <button
              className="btn btn-sm"
              disabled={pageIndex >= pages.length - 1}
              onClick={() => setPageIndex(pageIndex + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      <MergeSettings
        settings={settings}
        onChange={setSettings}
        dirName={dirName}
        onPickDir={onPickDir}
        onClearDir={onClearDir}
        onMerge={handleMerge}
        merging={merging}
        merged={merged}
        onSave={handleSave}
        saving={saving}
        nextFileName={nextFileName}
        status={status}
        selectedCount={selectedIds.length}
      />
    </>
  );
}