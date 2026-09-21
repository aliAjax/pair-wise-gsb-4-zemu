import { useState } from 'react';
import type { Level } from '../domain/types';

export interface PhraseFormValue {
  text: string;
  translation: string;
  tag: string;
  level: Level;
}

/** 添加 / 修改句子弹窗。修改时旧版本不可变提示由调用方传入。 */
export function PhraseModal({
  title,
  initial,
  warning,
  onCancel,
  onSave,
}: {
  title: string;
  initial?: Partial<PhraseFormValue>;
  warning?: string;
  onCancel: () => void;
  onSave: (v: PhraseFormValue) => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [translation, setTranslation] = useState(initial?.translation ?? '');
  const [tag, setTag] = useState(initial?.tag ?? '自定义');
  const [level, setLevel] = useState<Level>(initial?.level ?? '入门');

  const save = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), translation: translation.trim() || '待补充译文', tag: tag.trim() || '自定义', level });
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onCancel}>
            ×
          </button>
        </div>
        {warning && (
          <div className="modal-warn">{warning}</div>
        )}
        <label>
          句子
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="例如：I can make this happen."
          />
        </label>
        <label>
          译文
          <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="中文译文" />
        </label>
        <div className="modal-row">
          <label>
            标签
            <input value={tag} onChange={e => setTag(e.target.value)} />
          </label>
          <label>
            难度
            <select value={level} onChange={e => setLevel(e.target.value as Level)}>
              <option>入门</option>
              <option>进阶</option>
              <option>挑战</option>
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            取消
          </button>
          <button className="primary" onClick={save} disabled={!text.trim()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
