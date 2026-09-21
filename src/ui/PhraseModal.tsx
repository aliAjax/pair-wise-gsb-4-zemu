import { useEffect, useState } from 'react';
import type { Level } from '../domain/types';
import { currentVersion } from '../scheduler/scheduler';
import type { Phrase } from '../domain/types';
import type { NewPhraseInput } from '../domain/model';

interface Props {
  mode: 'add' | 'edit';
  phrase?: Phrase;
  onClose: () => void;
  onSubmit: (input: NewPhraseInput) => void;
}

const LEVELS: Level[] = ['入门', '进阶', '挑战'];

export function PhraseModal({ mode, phrase, onClose, onSubmit }: Props) {
  const base = phrase ? currentVersion(phrase) : undefined;
  const [text, setText] = useState(base?.text ?? '');
  const [translation, setTranslation] = useState(base?.translation ?? '');
  const [tag, setTag] = useState(phrase?.tag ?? '自定义');
  const [level, setLevel] = useState<Level>(phrase?.level ?? '入门');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const textChanged = phrase && base ? text.trim() !== base.text || translation.trim() !== base.translation : false;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{mode === 'add' ? '添加练习句子' : '修改句子'}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <label>英文句子
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="例如：I can make this happen."/>
        </label>
        <label>译文
          <input className="modal-input" value={translation} onChange={e => setTranslation(e.target.value)} placeholder="中文译文"/>
        </label>
        <div className="modal-row">
          <label>标签
            <input className="modal-input" value={tag} onChange={e => setTag(e.target.value)} placeholder="日常 / 工作…"/>
          </label>
          <label>难度
            <select className="modal-input" value={level} onChange={e => setLevel(e.target.value as Level)}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        {mode === 'edit' && (
          <p className="modal-note">
            {textChanged
              ? '文本或译文变化将产生新版本；旧录音与机器分保留在旧版本，未完成复习需用新版本重新达标。'
              : '仅修改标签 / 难度不产生新版本。'}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>取消</button>
          <button className="primary" disabled={!text.trim()} onClick={() => onSubmit({ text: text.trim(), translation: translation.trim() || '待补充译文', tag: tag.trim() || '自定义', level })}>
            {mode === 'add' ? '加入句子库' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
