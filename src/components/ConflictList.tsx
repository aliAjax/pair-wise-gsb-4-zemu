import { AlertTriangle } from 'lucide-react';
import { fmtDur } from '../domain/util';
import type { Conflict } from '../domain/types';

/** 冲突表：句子、次数、原值、规则 */
export function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="conflict-box">
      <div className="conflict-title">
        <AlertTriangle size={15} />
        <strong>批次被拦截 · 整批未写入，草稿已保留</strong>
      </div>
      <table className="conflict-table">
        <thead>
          <tr>
            <th>句子</th>
            <th className="num">次数（原值 + 本批 = 合并）</th>
            <th className="num">用时</th>
            <th>违反规则</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c, i) => {
            const over = c.counts ? c.counts.result > c.counts.limit : false;
            return (
              <tr key={i}>
                <td>
                  <strong className="clamp">{c.phraseText}</strong>
                  {c.versionNo ? <small>版本 v{c.versionNo}</small> : <small>当天合计</small>}
                </td>
                <td className="num">
                  {c.counts ? (
                    <span className={over ? 'over' : ''}>
                      {c.counts.base} + {c.counts.add} = {c.counts.result} / {c.counts.limit}
                    </span>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td className="num">
                  {c.seconds ? (
                    <span className={c.seconds.result > c.seconds.limit ? 'over' : ''}>
                      {fmtDur(c.seconds.base)} + {fmtDur(c.seconds.add)} = {fmtDur(c.seconds.result)} /{' '}
                      {fmtDur(c.seconds.limit)}
                    </span>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td>
                  <span className="rule-tag">{c.ruleText}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="conflict-foot">请删掉部分条目或等次日额度恢复后重新提交；刷新页面后队列、批次与版本仍保持一致。</p>
    </div>
  );
}
