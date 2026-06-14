import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Brain,
  Camera,
  CheckCircle,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';

const mainActions = [
  {
    title: '提交问题',
    description: '把你真正卡住的问题放进问题星球，等待回答，也让同样的问题被看见。',
    to: '/qa#question-submit',
    icon: MessageCircle,
    accent: 'text-cyan-200 bg-cyan-300/10 border-cyan-300/20',
  },
  {
    title: '寻找伙伴',
    description: '用技能供需、标签和社群身份找到能互补的人，从一个具体需求开始连接。',
    to: '/community?tab=partners',
    icon: Users,
    accent: 'text-fuchsia-100 bg-fuchsia-300/10 border-fuchsia-300/20',
  },
  {
    title: '发布打卡',
    description: '记录今天的训练、学习或项目推进，让行动变成社区里可见的长期线索。',
    to: '/community?tab=moments',
    icon: Camera,
    accent: 'text-emerald-100 bg-emerald-300/10 border-emerald-300/20',
  },
];

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
];

const proofItems = [
  { label: '问题沉淀', value: '跨平台整理高频提问' },
  { label: '伙伴名片', value: '展示能提供与正在寻找' },
  { label: '行动打卡', value: '记录学习、训练和项目推进' },
];

const Home: React.FC = () => {
  return (
    <div className="page-aurora min-h-screen pb-16">
      <section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/70 shadow-2xl shadow-cyan-950/25">
        <div className="relative px-4 py-8 sm:px-6 md:px-10 md:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_88%_6%,rgba(236,72,153,0.14),transparent_34%)]" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.82fr)] lg:items-center lg:justify-between">
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
                  to="/qa#question-submit"
                  className="neon-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  提交新问题
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/community?tab=partners"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/12"
                >
                  找伙伴
                  <Users className="h-4 w-4" />
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

            <div className="rounded-2xl border border-white/10 bg-slate-950/76 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-sm font-semibold text-white">今天先做一件事</div>
                  <div className="mt-1 text-xs text-slate-400">不用逛完整站，直接进入最常用入口</div>
                </div>
                <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  社区入口
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {mainActions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group block rounded-xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${action.accent}`}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-bold text-white">
                          {action.title}
                          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{action.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-black text-white">你可以在这里做什么</h2>
            <p className="mt-2 text-sm text-slate-400">围绕问题、伙伴、行动和产品共创，把社区变成可持续使用的工具。</p>
          </div>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
          >
            了解马健文
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <section className="mx-auto mt-8 max-w-6xl rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5 shadow-xl shadow-slate-950/20 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">现在就加入一条线索</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              一个好问题、一张伙伴名片、一次打卡，都能让后面的人更快找到方向。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {mainActions.map((action) => (
              <Link
                key={action.title}
                to={action.to}
                className="group rounded-xl border border-white/10 bg-slate-950/55 p-4 text-sm font-semibold text-white transition hover:border-cyan-300/25 hover:bg-slate-950/75"
              >
                <action.icon className="mb-3 h-5 w-5 text-cyan-200" />
                <span>{action.title}</span>
                <ArrowRight className="mt-3 h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
