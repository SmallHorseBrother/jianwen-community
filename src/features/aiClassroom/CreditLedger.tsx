import React, { useEffect, useState } from 'react';
import { shopApi } from './shopApi';
import { ledgerLabel, type LedgerEntry } from './shopModel';

const LIMIT = 30;
const when = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// 积分明细：展开时才读取；refreshKey 变化（余额变了、刚买完）时重新读取
const CreditLedger: React.FC<{ userId: string; refreshKey?: string | number }> = ({ userId, refreshKey }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    shopApi.ledger(userId, LIMIT)
      .then((value) => { if (active) { setRows(value); setError(''); } })
      .catch((caught: Error) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [open, userId, refreshKey]);

  return (
    <details className="cw-ledger" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>积分明细</summary>
      {error ? <p className="cw-msg bad">{error}</p>
        : !rows ? <p className="cw-muted" role="status">正在读取…</p>
        : rows.length === 0 ? <p className="cw-muted">还没有积分记录。</p>
        : (
          <>
            <table>
              <thead><tr><th scope="col">时间</th><th scope="col">项目</th><th scope="col">变动</th><th scope="col">余额</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{when(row.created_at)}</td>
                    <td>{ledgerLabel(row.reason)}{row.reason === 'purchase' && row.note ? <small>{row.note}</small> : null}</td>
                    <td className={row.delta > 0 ? 'plus' : 'minus'}>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                    <td>{row.balance_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length >= LIMIT && <p className="cw-muted">只显示最近 {LIMIT} 条。</p>}
          </>
        )}
    </details>
  );
};

export default CreditLedger;
