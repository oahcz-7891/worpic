import type { ExportSettings, OutputFormat } from '../types';
import { resetCounter, supportsDirectoryPicker } from '../utils/save';

interface Props {
  settings: ExportSettings;
  onChange: (s: ExportSettings) => void;
  dirName: string | null;
  onPickDir: () => void;
  onClearDir: () => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
  nextFileName: string;
  status: string;
  disabledHint: string;
  sizeWarning: string;
}

const FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG（无损，支持透明）' },
  { value: 'jpg', label: 'JPG（有损，体积小）' },
  { value: 'webp', label: 'WebP（现代格式）' },
];

function NumberField({
  label, value, onChange,
}: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={1}
        max={8192}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n) && n > 0) onChange(Math.round(n));
        }}
      />
      <em>px</em>
    </label>
  );
}

export default function ExportPanel({
  settings, onChange, dirName, onPickDir, onClearDir, onExport, exporting, canExport, nextFileName, status,
  disabledHint, sizeWarning,
}: Props) {
  const supportDir = supportsDirectoryPicker();
  const isLossy = settings.format !== 'png';

  return (
    <div className="export-panel">
      <div className="panel-title-row">
        <h2>导出设置</h2>
        <button className="btn btn-ghost btn-sm" onClick={resetCounter}>重置序号</button>
      </div>

      <div className="form-grid">
        <NumberField label="目标宽度" value={settings.width} onChange={(n) => onChange({ ...settings, width: n })} />
        <NumberField label="目标高度" value={settings.height} onChange={(n) => onChange({ ...settings, height: n })} />

        <label className="field">
          <span>输出格式</span>
          <select
            value={settings.format}
            onChange={(e) => onChange({ ...settings, format: e.target.value as OutputFormat })}
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>

        {isLossy && (
          <label className="field">
            <span>质量：{Math.round(settings.quality * 100)}%</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={settings.quality}
              onChange={(e) => onChange({ ...settings, quality: Number(e.target.value) })}
            />
          </label>
        )}

        {settings.format === 'jpg' && (
          <label className="field">
            <span>背景色</span>
            <input
              type="color"
              value={settings.bgColor}
              onChange={(e) => onChange({ ...settings, bgColor: e.target.value })}
            />
          </label>
        )}

        <label className="field">
          <span>文件名前缀</span>
          <input
            type="text"
            value={settings.prefix}
            placeholder="如 product"
            onChange={(e) => onChange({ ...settings, prefix: e.target.value })}
          />
        </label>
      </div>

      <div className="next-name-row">
        <span>下次导出文件名</span>
        <code>{nextFileName}</code>
      </div>

      {sizeWarning && <div className="size-warn">{sizeWarning}</div>}

      <div className="dir-row">
        {supportDir ? (
          dirName ? (
            <div className="dir-info">
              <span className="dir-ok">保存目录：{dirName}</span>
              <div className="dir-actions">
                <button className="btn btn-secondary btn-sm" onClick={onPickDir}>
                  更换文件夹
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onClearDir}>
                  不使用目录
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={onPickDir}>
              选择保存文件夹
            </button>
          )
        ) : (
          <span className="dir-warn">当前浏览器不支持选择文件夹，将逐张下载保存（建议用 Chrome/Edge）</span>
        )}
      </div>

      <button
        className="btn btn-primary btn-export"
        onClick={onExport}
        disabled={exporting || !canExport}
      >
        {exporting ? '导出中…' : '导出图片'}
      </button>

      {!canExport && disabledHint && <div className="status">{disabledHint}</div>}

      {status && <div className="status">{status}</div>}
    </div>
  );
}