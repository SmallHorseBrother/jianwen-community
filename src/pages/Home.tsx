import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';

const productEntrances = [
  {
    title: '问题星球',
    description: '把分散在各个平台的问题收进一个可搜索、可同问、可回答的知识入口。',
    to: '/qa',
    icon: Brain,
  },
  {
    title: '找伙伴',
    description: '看见每个人能提供什么、正在寻找什么，让连接从具体需求开始。',
    to: '/community?tab=partners',
    icon: Search,
  },
  {
    title: '社区动态',
    description: '健身、学习、项目推进都可以打卡，形成更轻的日常运营场。',
    to: '/community?tab=moments',
    icon: Activity,
  },
  {
    title: '产品实验室',
    description: '集中展示食探、教链、Pull-up Index 等正在推进的产品和共创反馈。',
    to: '/tools',
    icon: Wrench,
  },
  {
    title: '关于马健文',
    description: '个人经历、AI 分身、粉丝群、线上咨询、创业合作和招募入口。',
    to: '/about',
    icon: Sparkles,
  },
];

const proofItems = [
  { label: '问题沉淀', value: '跨平台整理高频提问' },
  { label: '伙伴名片', value: '展示能提供与正在寻找' },
  { label: '行动打卡', value: '记录学习、训练和项目推进' },
];

const Home: React.FC = () => {
  return (
    <div className="page-aurora min-h-screen pb-12">
      <section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/70 shadow-2xl shadow-cyan-950/25">
        <div className="relative px-4 py-8 sm:px-6 md:px-10 md:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_88%_6%,rgba(236,72,153,0.14),transparent_34%)]" />
          <div className="relative z-10">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <Sparkles className="h-4 w-4" />
                健身、学习、AI 产品与真实连接
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl md:text-6xl lg:text-7xl">
                健文社区
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                把你的问题、目标和行动留在这里，和同样在训练、学习、做产品的人互相看见。
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                问题星球沉淀高频提问，伙伴名片连接真实需求，社区动态记录每天的进步。
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="#core-entrances"
                  className="neon-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  查看核心入口
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/12"
                >
                  粉丝群、咨询与合作
                  <Sparkles className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {proofItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-200" />
                      {item.label}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="core-entrances" className="mx-auto mt-8 max-w-6xl scroll-mt-24">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-black text-white">你可以在这里做什么</h2>
            <p className="mt-2 text-sm text-slate-400">围绕问题、伙伴、行动和产品共创，把社区变成可持续使用的工具。</p>
          </div>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
          >
            粉丝群、咨询与合作
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {productEntrances.map((entry) => (
            <Link
              key={entry.title}
              to={entry.to}
              className="group rounded-xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-slate-900/80"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <entry.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-white">{entry.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{entry.description}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-200">
                进入
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
