import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../../services/checkInService';

type Leader = Awaited<ReturnType<typeof getLeaderboard>>[number];
const Leaderboard: React.FC<{ revision?: number }> = ({ revision = 0 }) => {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    void getLeaderboard().then((data) => { if (active) setLeaders(data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <div className="ranking-panel">
    <h2>打卡排行榜</h2><p>Top 10 · 最近 200 条打卡</p>
    {loading ? <p className="py-6" role="status">正在加载排行榜…</p> : error ? <p className="py-6" role="status">排行榜暂时无法加载，请刷新重试。</p> : leaders.length === 0 ? <p className="py-6">等你来打卡。</p> : <ol>{leaders.map((item,index) => <li className="ranking-row" key={item.user.nickname + index}>
      <span className="ranking-position">{index + 1}</span><span className="ranking-avatar">{item.user.avatar_url ? <img src={item.user.avatar_url} alt="" loading="lazy" /> : item.user.nickname?.slice(0,1) || '友'}</span><span className="ranking-name" title={item.user.nickname}>{item.user.nickname}</span><span className="ranking-count">{item.count} <small>次</small></span>
    </li>)}</ol>}
  </div>;
};
export default Leaderboard;
