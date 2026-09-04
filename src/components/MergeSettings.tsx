import type { ReactNode } from 'react';
import { PAPER_PRESETS, type MergeSettings } from '../utils/merge';
import { supportsDirectoryPicker } from '../utils/save';

interface Props {
  settings: MergeSettings;
  onChange: (s: MergeSettings) => void;
  dirName: string | null;
  onPickDir: () => void;
  onClearDir: () => void;
  onMerge: () => void;
  merging: boolean;
  merged: boolean;
  onSave: () => void;
  saving: boolean;
  nextFileName: string;
  status: string;
  selectedCount: number;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function MergeSettings({
  settings, onChange, dirName, onPickDir, onClearDir,
  onMerge, merging, merged, onSave, saving, nextFileName, status, selectedCount,
}: Props) {
  const supportDir = supportsDirectoryPicker();
  const custom = settings.paperId === 'custom';
  const canMerge = selectedCount > 0 && !merging;

  const setRows = (v: number) => onChange({ ...settings, rows: Math.max(1, Math.min(20, v)) });
  const setCols = (v: number) => onChange({ ...settings, cols: Math.max(1, Math.min(20, v)) });

  return (
    <div className="export-panel">
      <div className="panel-title-row">
        <h2>合并设置</h2>
      </div>

      <div className="form-grid">
        <Field label="纸张尺寸（默认 A4）">
          <select
            value={settings.paperId}
            onChange={(e) => {
              const id = e.target.value;
              const preset = PAPER_PRESETS.find((p) => p.id === id);
              onChange({
                ...settings,
                paperId: id,
                ...(preset ? { width: preset.width, height: preset.height } : {}),
              });
            }}
          >
            {PAPER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">自定义尺寸</option>
          </select>
        </Field>

        {custom && (
          <div className="field-row">
            <Field label="宽度(px)">
              <input
                type="number" min={1} max={10000}
                value={settings.width}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0) onChange({ ...settings, width: Math.round(n) });
                }}
              />
            </Field>
            <Field label="高度(px)">
              <input
                type="number" min={1} max={10000}
                value={settings.height}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0) onChange({ ...settings, height: Math.round(n) });
                }}
              />
            </Field>
          </div>
        )}

        <div className="field-row">
          <Field label="行数">
            <input
              type="number" min={1} max={20}
              value={settings.rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </Field>
          <Field label="列数">
            <input
              type="number" min={1} max={20}
              value={settings.cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label="格子间距(px)">
          <div className="slider-input-row">
            <input
              type="range" min={0} max={100} step={1}
              value={settings.gap}
              onChange={(e) => onChange({ ...settings, gap: Number(e.target.value) })}
            />
            <input
              className="zoom-input"
              type="number" min={0} max={100}
              value={settings.gap}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) onChange({ ...settings, gap: Math.max(0, Math.min(100, Math.round(n))) });
              }}
            />
          </div>
        </Field>

        <Field label="页边距(px)">
          <div className="slider-input-row">
            <input
              type="range" min={0} max={200} step={1}
              value={settings.margin}
              onChange={(e) => onChange({ ...settings, margin: Number(e.target.value) })}
            />
            <input
              className="zoom-input"
              type="number" min={0} max={200}
              value={settings.margin}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) onChange({ ...settings, margin: Math.max(0, Math.min(200, Math.round(n))) });
              }}
            />
          </div>
        </Field>

        <div className="field-row">
          <Field label="背景色">
            <input
              type="color"
              value={settings.bgColor}
              onChange={(e) => onChange({ ...settings, bgColor: e.target.value })}
            />
          </Field>
          <Field label="文件名前缀">
            <input
              type="text"
              value={settings.prefix}
              placeholder="如 merged"
              onChange={(e) => onChange({ ...settings, prefix: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="next-name-row">
        <span>下次保存文件名</span>
        <code>{nextFileName}</code>
      </div>

      <div className="dir-row">
        {supportDir ? (
          dirName ? (
            <div className="dir-info">
              <span className="dir-ok">保存目录：{dirName}</span>
              <div className="dir-actions">
                <button className="btn btn-sm" onClick={onPickDir}>更换文件夹</button>
                <button className="btn btn-ghost btn-sm" onClick={onClearDir}>不使用目录</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-block" onClick={onPickDir}>选择保存文件夹</button>
          )
        ) : (
          <span className="dir-warn">当前浏览器不支持选择文件夹，保存时将下载</span>
        )}
      </div>

      <button className="btn btn-primary btn-export" onClick={onMerge} disabled={!canMerge}>
        {merging ? '合并中…' : '自动合并'}
      </button>

      <button
        className="btn btn-export"
        onClick={onSave}
        disabled={!merged || saving}
        style={{ marginTop: 8 }}
      >
        {saving ? '保存中…' : '保存'}
      </button>

      {status && <div className="status">{status}</div>}
    </div>
  );
}