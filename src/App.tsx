import { useCallback, useEffect, useRef, useState } from 'react';import ImageLibrary from './components/ImageLibrary';
import CropWorkspace from './components/CropWorkspace';
import ExportPanel from './components/ExportPanel';
import MergeWorkspace from './components/MergeWorkspace';
import { addImageFiles, clearImages, deleteImage, getAllImages } from './db';
import type { CropAreaPixels, ExportSettings, LibraryImage } from './types';
import { loadImageFromBlob, cropToBlob } from './utils/crop';
import {
  baseName,
  buildFileName,
  downloadBlob,
  getCounter,
  nextCounter,
  pickDirectory,
  resetCounter,
  saveBlobToDirectory,
} from './utils/save';

const DEFAULT_SETTINGS: ExportSettings = {
  width: 800,
  height: 600,
  format: 'png',
  quality: 0.9,
  prefix: 'output',
  bgColor: '#ffffff',
};

// canvas 安全尺寸上限（超出后浏览器可能无法绘制）
const MAX_EDGE = 8192;
const MAX_AREA = 64 * 1024 * 1024;

export default function App() {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cropArea, setCropArea] = useState<CropAreaPixels | null>(null);
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<'crop' | 'merge'>('crop');
  /** 用户是否手动改过文件名前缀（改过则切换图片不再自动覆盖） */
  const prefixTouchedRef = useRef(false);
  /** 用户是否手动改过目标尺寸（改过则切换图片不再自动跟随原图） */
  const sizeTouchedRef = useRef(false);

  const refreshImages = useCallback(async () => {
    setImages(await getAllImages());
  }, []);

  useEffect(() => {
    refreshImages().finally(() => setLoading(false));
  }, [refreshImages]);

  const selected = images.find((i) => i.id === selectedId) ?? null;

  /** 选择图片：默认用原图文件名（去扩展名）作为导出前缀（除非用户已自定义）；新图片重置导出序号 */
  const handleSelect = (id: number) => {
    if (id !== selectedId) {
      setSelectedId(id);
      if (!prefixTouchedRef.current) {
        const img = images.find((i) => i.id === id);
        if (img) {
          const name = baseName(img.name);
          setSettings((s) => (name && s.prefix !== name ? { ...s, prefix: name } : s));
        }
      }
      // 新图片：导出尺寸默认跟随原图尺寸（除非用户已手动自定义）
      if (!sizeTouchedRef.current) {
        const img = images.find((i) => i.id === id);
        if (img) {
          setSettings((s) => (s.width !== img.width || s.height !== img.height
            ? { ...s, width: img.width, height: img.height }
            : s));
        }
      }
      resetCounter(); // 新图片从 _001 开始编号
    }
  };

  /** 导出设置变更：标记前缀是否被用户手动修改 */
  const handleSettingsChange = (next: ExportSettings) => {
    setSettings((prev) => {
      if (next.prefix !== prev.prefix) prefixTouchedRef.current = true;
      if (next.width !== prev.width || next.height !== prev.height) sizeTouchedRef.current = true;
      return next;
    });
  };

  const handleImport = async (files: File[]) => {
    await addImageFiles(Array.from(files));
    await refreshImages();
    setStatus(`已导入 ${files.length} 张图片`);
  };

  const handleDelete = async (id: number) => {
    await deleteImage(id);
    await refreshImages();
    if (selectedId === id) setSelectedId(null);
  };

  const handleClear = async () => {
    await clearImages();
    await refreshImages();
    setSelectedId(null);
  };

  const handlePickDir = async () => {
    const handle = await pickDirectory();
    if (handle) {
      setDirHandle(handle);
      setDirName(handle.name);
      setStatus(`已选择保存目录：${handle.name}`);
    } else if (!('showDirectoryPicker' in window)) {
      setStatus('浏览器不支持选择文件夹，导出时将使用下载方式');
    }
  };

  /** 取消目录授权，导出改为下载 */
  const handleClearDir = () => {
    setDirHandle(null);
    setDirName(null);
    setStatus('已取消保存目录，导出将使用下载方式');
  };

  const handleExport = async () => {
    if (!selected || !cropArea) {
      setStatus('请先在图片库选择图片并调整裁剪框');
      return;
    }
    setExporting(true);
    try {
      const img = await loadImageFromBlob(selected.blob);
      const blob = await cropToBlob(img, cropArea, settings);
      const counter = nextCounter();
      const name = buildFileName(settings.prefix, counter, settings.format);
      if (dirHandle) {
        await saveBlobToDirectory(dirHandle, name, blob);
        setStatus(`已保存 ${name} → ${dirName}`);
      } else {
        downloadBlob(blob, name);
        setStatus(`已下载 ${name}（未选择文件夹）`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`导出失败：${msg}`);
      window.alert(`导出失败：${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const nextFileName = buildFileName(settings.prefix, getCounter() + 1, settings.format);
  const canExport = Boolean(selected && cropArea);
  const disabledHint = !selected
    ? '请先在左侧图片库选择一张图片'
    : !cropArea
      ? '请先点击「裁剪」生成裁剪框并调整位置'
      : '';
  const sizeWarning =
    settings.width > MAX_EDGE || settings.height > MAX_EDGE
      ? '尺寸超过 8192px，浏览器可能无法绘制，建议减小'
      : settings.width * settings.height > MAX_AREA
        ? '面积过大（超过 6400 万像素），导出可能失败，建议减小'
        : '';

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">截图裁剪工具</div>
        <div className="header-sub">导入图片 → 裁剪 / 合并 → 保存到文件夹</div>
        <div className="mode-tabs">
          <button
            className={`mode-tab${mode === 'crop' ? ' active' : ''}`}
            onClick={() => setMode('crop')}
          >
            裁剪
          </button>
          <button
            className={`mode-tab${mode === 'merge' ? ' active' : ''}`}
            onClick={() => setMode('merge')}
          >
            合并
          </button>
        </div>
      </header>

      <div className="workspace">
        {mode === 'crop' ? (
          <>
            <ImageLibrary
              images={images}
              selectedId={selectedId}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onImport={handleImport}
              onClear={handleClear}
            />

            <main className="main">
              {loading ? (
                <div className="center-hint">加载图片库…</div>
              ) : (
                <CropWorkspace
                  image={selected}
                  width={settings.width}
                  height={settings.height}
                  onCropAreaChange={setCropArea}
                />
              )}
              <ExportPanel
                settings={settings}
                onChange={handleSettingsChange}
                dirName={dirName}
                onPickDir={handlePickDir}
                onClearDir={handleClearDir}
                onExport={handleExport}
                exporting={exporting}
                canExport={canExport}
                nextFileName={nextFileName}
                status={status}
                disabledHint={disabledHint}
                sizeWarning={sizeWarning}
              />
            </main>
          </>
        ) : (
          <main className="main">
            <MergeWorkspace
              images={images}
              dirHandle={dirHandle}
              dirName={dirName}
              onPickDir={handlePickDir}
              onClearDir={handleClearDir}
              onImport={handleImport}
              onClearLibrary={handleClear}
            />
          </main>
        )}
      </div>
    </div>
  );
}