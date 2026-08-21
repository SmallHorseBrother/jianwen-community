import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bot,
  Brain,
  CircleDot,
  Fingerprint,
  Orbit,
  Search,
  Sparkles,
  Users,
  Wand2,
  Wrench,
  Zap,
} from 'lucide-react';
import SpotlightLink from '../components/Common/SpotlightLink';

const productEntrances = [
  {
    eyebrow: 'KNOWLEDGE ORBIT',
    title: '问题星球',
    description: '把散落在群聊与日常里的问题，变成可搜索、可同问、持续生长的公共知识。',
    to: '/qa',
    icon: Brain,
    index: '01',
    accent: 'cyan',
    size: 'wide',
  },
  {
    eyebrow: 'AI GROWTH LOOP',
    title: 'AI 成长路径',
    description: '从能力测评、七天学习路径到真实作品，用证据记录每一次进步。',
    to: '/ai',
    icon: Bot,
    index: '02',
    accent: 'violet',
    size: 'tall',
  },
  {
    eyebrow: 'PEOPLE MATCHING',
    title: '找到同行者',
    description: '不靠空泛标签，直接看见彼此能提供什么、正在寻找什么。',
    to: '/community?tab=partners',
    icon: Users,
    index: '03',
    accent: 'lime',
    size: 'normal',
  },
  {
    eyebrow: 'DAILY SIGNAL',
    title: '社区动态',
    description: '记录训练、学习和项目推进，让微小行动形成彼此可见的节奏。',
    to: '/community?tab=moments',
    icon: Activity,
    index: '04',
    accent: 'rose',
    size: 'normal',
  },
  {
    eyebrow: 'BUILD IN PUBLIC',
    title: '产品实验室',
    description: '食探、教链、Pull-up Index 与更多真实产品，在反馈中持续迭代。',
    to: '/tools',
    icon: Wrench,
    index: '05',
    accent: 'amber',
    size: 'wide',
  },
];

const Home: React.FC = () => {
  return (
    <div className="home-v3">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-status-chip"><i /><span>COMMUNITY ONLINE</span><small>真实的人 · 真实的问题 · 真实的行动</small></div>
          <h1 id="home-title">
            把好奇心变成
            <span>正在发生的事。</span>
          </h1>
          <p>健文社区是一个关于健身、学习、AI 与产品共创的行动网络。在这里，问题会被沉淀，伙伴会被看见，想法最终会长成作品。</p>
          <div className="home-hero-actions">
            <Link to="/community?tab=partners" className="home-primary-action">
              <span>找到同行者</span><ArrowRight />
            </Link>
            <Link to="/ai" className="home-secondary-action">
              <Sparkles /><span>开始 AI 成长路径</span>
            </Link>
          </div>
          <div className="home-hero-footnote">
            <span><Fingerprint />不制造信息流焦虑</span>
            <span><CircleDot />每一次参与都有去处</span>
          </div>
        </div>

        <div className="home-orbit-stage" aria-label="从问题到行动的社区连接模型">
          <div className="home-orbit-halo home-orbit-halo-one" />
          <div className="home-orbit-halo home-orbit-halo-two" />
          <div className="home-orbit-path home-orbit-path-one"><span /></div>
          <div className="home-orbit-path home-orbit-path-two"><span /></div>
          <div className="home-orbit-core">
            <Orbit />
            <small>JIANWEN</small>
            <strong>问题 → 行动</strong>
            <span>让连接产生结果</span>
          </div>
          <div className="home-orbit-node node-question"><Brain /><span>问题沉淀</span><small>132 条线索</small></div>
          <div className="home-orbit-node node-people"><Users /><span>伙伴连接</span><small>能力 × 需求</small></div>
          <div className="home-orbit-node node-action"><Zap /><span>行动发生</span><small>今天 +18</small></div>
          <div className="home-live-card">
            <div><i /><span>LIVE SIGNAL</span></div>
            <strong>“想找一起做 AI 小产品的伙伴”</strong>
            <small>2 分钟前 · 已有 3 人回应</small>
          </div>
        </div>

        <a href="#explore" className="home-scroll-cue"><span>向下探索</span><ArrowDown /></a>
      </section>

      <section className="home-signal-rail" aria-label="社区关键词">
        <div>
          <span>AI 实践</span><i />
          <span>问题共创</span><i />
          <span>长期主义</span><i />
          <span>训练记录</span><i />
          <span>找到伙伴</span><i />
          <span>产品实验</span><i />
          <span>AI 实践</span><i />
          <span>问题共创</span><i />
          <span>长期主义</span><i />
          <span>训练记录</span><i />
        </div>
      </section>

      <section id="explore" className="home-explore">
        <div className="home-section-heading">
          <div><span>EXPLORE THE NETWORK</span><h2>不只是浏览，<br />选择一个入口开始行动。</h2></div>
          <p>每个入口都对应一种真实需求。光标经过卡片时，社区里的路径会被点亮。</p>
        </div>

        <div className="home-bento-grid">
          {productEntrances.map((entry) => (
            <SpotlightLink
              key={entry.title}
              to={entry.to}
              className={`home-bento-card is-${entry.size} accent-${entry.accent}`}
            >
              <div className="home-card-glow" />
              <div className="home-card-top"><span>{entry.eyebrow}</span><small>{entry.index}</small></div>
              <div className="home-card-icon"><entry.icon /></div>
              <div className="home-card-copy">
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
              </div>
              <div className="home-card-action"><span>进入模块</span><ArrowRight /></div>
            </SpotlightLink>
          ))}

          <SpotlightLink to="/about" className="home-bento-card home-about-card accent-paper">
            <div className="home-card-top"><span>THE PERSON BEHIND IT</span><small>06</small></div>
            <Wand2 className="home-about-spark" />
            <div className="home-card-copy"><h3>认识马健文</h3><p>社区为什么存在，以及粉丝群、咨询、合作与共同建设的入口。</p></div>
            <div className="home-card-action"><span>查看故事</span><ArrowRight /></div>
          </SpotlightLink>
        </div>
      </section>

      <section className="home-flow-section">
        <div className="home-flow-intro">
          <span>HOW IT GROWS</span>
          <h2>一次有效连接，<br />只需要三个动作。</h2>
          <p>社区不追求无限滚动。我们更关心：一个问题是否变清楚，一个人是否被连接，一个行动是否真正发生。</p>
          <Link to="/guide">查看社区使用指南 <ArrowRight /></Link>
        </div>
        <div className="home-flow-track">
          <div className="home-flow-line"><i /></div>
          <article><small>STEP 01</small><span><Search /></span><div><h3>留下具体问题</h3><p>描述背景、目标和限制，让真正有经验的人能够接住。</p></div></article>
          <article><small>STEP 02</small><span><Users /></span><div><h3>连接对的人</h3><p>通过能力、需求与正在做的事匹配，而不是交换模糊名片。</p></div></article>
          <article><small>STEP 03</small><span><Zap /></span><div><h3>让行动留下证据</h3><p>用回答、打卡、作品与复盘，把一次交流变成长期积累。</p></div></article>
        </div>
      </section>

      <section className="home-final-cta">
        <div className="home-final-orb"><span>J</span><i /></div>
        <div><small>YOUR NEXT MOVE</small><h2>别只收藏想法。<br /><em>让它开始发生。</em></h2></div>
        <Link to="/community?tab=partners"><span>进入社区网络</span><ArrowRight /></Link>
      </section>
    </div>
  );
};

export default Home;
