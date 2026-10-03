import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Orbit, Users } from 'lucide-react';
import { getPublicPartnerProfiles } from '../services/partnerService';

const Home: React.FC = () => {
  const [partners, setPartners] = useState<Array<{ id: string; nickname: string; avatar_url: string | null }>>([]);
  useEffect(() => {
    let active = true;
    void getPublicPartnerProfiles().then((items) => {
      if (active) setPartners(items.slice(0,3));
    }).catch(() => { /* The community entry remains available when the feed is offline. */ });
    return () => { active = false; };
  }, []);
  return (
    <div className="redesign-home">
      <header className="page-heading"><div><h1>健文社区</h1><p>学习 · 训练 · 交流</p></div></header>
      <div className="home-stage">
        <Link to="/community?tab=moments" className="home-checkin">
          <h2>打卡</h2><p>今天也有进步。</p>
          <span className="home-checkin-image"><img src="/images/community/checkin-flowers.jpg" alt="社区成员分享的花束" /></span>
          <span className="home-card-caption">记录行动 · 看排行榜</span><ArrowUpRight className="home-card-arrow" />
        </Link>
        <Link to="/qa" className="home-planet"><Orbit aria-hidden="true" /><h2>问题星球</h2><p>每一个问题，<br />都有值得探索的答案。</p><span className="home-card-caption">从一个问题开始探索</span><ArrowUpRight className="home-card-arrow" /></Link>
        <Link to="/community?tab=partners" className="home-partners"><h2>找伙伴</h2><p>技能互补，一起向前。</p>{partners.length ? <span className="home-avatars">{partners.map((profile) => <span className="ranking-avatar" key={profile.id}>{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.nickname} /> : profile.nickname.slice(0,1)}</span>)}</span> : <Users size={44} aria-hidden="true" />}<ArrowUpRight className="home-card-arrow" /></Link>
      </div>
    </div>
  );
};
export default Home;
