import { useCallback, useRef, useState } from 'react';
import MergePicker from './MergePicker';
import MergeSettings from './MergeSettings';
import type { LibraryImage } from '../types';
import { loadImageFromBlob } from '../utils/crop';
import { DEFAULT_MERGE_SETTINGS, mergeImages, type MergeSettings as MergeSettingsType } from '../utils/merge';
import {
  buildFileName,
  downloadBlob,
  getCounter,
  nextCounter,
  saveBlobToDirectory,
} from '../utils/save';

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const mergedCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  /** 自动合并：加载所选图片 → 按行列合成到纸张 → 预览 */
  const handleMerge = async () => {
    if (!selectedIds.length) return;
    setMerging(true);
    setStatus('');
    try {
      const full = selectedIds
        .map((id) => images.find((i) => i.id === id))
        .filter((i): i is LibraryImage => Boolean(i));
      const used = full.slice(0, settings.rows * settings.cols);
      if (used.length < full.length) {
        setStatus(`注意：仅使用前 ${used.length} 张（行列容量 ${settings.rows * settings.cols}）`);
      }
      const imgs = await Promise.all(used.map((i) => loadImageFromBlob(i.blob)));
      const canvas = await mergeImages(imgs, settings);
      mergedCanvasRef.current = canvas;
      setPreviewUrl(canvas.toDataURL('image/png'));
      setMerged(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`合并失败：${msg}`);
      window.alert(`合并失败：${msg}`);
    } finally {
      setMerging(false);
    }
  };

  /** 保存：合并成功后可保存（目录写入或下载） */
  const handleSave = async () => {
    const canvas = mergedCanvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/png');
      });
      const counter = nextCounter();
      const name = buildFileName(settings.prefix, counter, 'png');
      if (dirHandle) {
        await saveBlobToDirectory(dirHandle, name, blob);
        setStatus(`已保存 ${name} → ${dirName}`);
      } else {
        downloadBlob(blob, name);
        setStatus(`已下载 ${name}（未选择文件夹）`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`保存失败：${msg}`);
      window.alert(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const nextFileName = buildFileName(settings.prefix, getCounter() + 1, 'png');

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
            纸张 {settings.width}×{settings.height}px · {settings.rows}×{settings.cols}
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