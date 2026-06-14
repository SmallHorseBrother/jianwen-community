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
    title: '提交一个真实问题',
    description: '把评论区、私信和群聊里的高频问题沉淀到问题星球，等待回答和同问。',
    to: '/qa#question-submit',
    icon: MessageCircle,
    accent: 'text-cyan-200 bg-cyan-300/10 border-cyan-300/20',
  },
  {
    title: '找一个能互相成就的人',
    description: '用技能供需、标签和社群身份找到伙伴，而不是只看一个昵称。',
    to: '/community?tab=partners',
    icon: Users,
    accent: 'text-fuchsia-100 bg-fuchsia-300/10 border-fuchsia-300/20',
  },
  {
    title: '发一次学习或训练打卡',
    description: '把每天的行动留在社区动态里，让坚持被看见，也更容易被接住。',
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
  '问题来自评论区、私信、微信群、腾讯文档和网站',
  '伙伴名片围绕“我能提供”和“我正在寻找”组织',
  '动态流和排行榜承接学习、训练、项目行动',
];

const Home: React.FC = () => {
  return (
    <div className="page-aurora min-h-screen pb-16">
      <section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/72 shadow-2xl shadow-cyan-950/25">
        <div className="relative px-4 py-8 sm:px-6 md:px-10 md:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_88%_4%,rgba(236,72,153,0.16),transparent_32%)]" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <Sparkles className="h-4 w-4" />
                健身、学习、AI 产品与真实连接
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl md:text-6xl">
                健文社区
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                这里不是一个单纯的个人主页，而是把问题沉淀、伙伴匹配、学习训练打卡和产品共创放在一起的社区入口。
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
                    key={item}
                    className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm leading-6 text-slate-300"
                  >
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-200" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-sm font-semibold text-white">今天可以从这里开始</div>
                  <div className="mt-1 text-xs text-slate-400">问题、伙伴、行动都在同一个社区里</div>
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
            <h2 className="text-2xl font-black text-white">核心入口</h2>
            <p className="mt-2 text-sm text-slate-400">新成员进来后，优先看到能马上参与的产品面。</p>
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

      <section className="mx-auto mt-8 max-w-6xl rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-slate-950/20 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">从一个具体动作开始</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              如果你刚来社区，不需要先逛完整站。问一个卡住的问题，找一个能互补的伙伴，或者把今天的训练和学习进度发出来。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {mainActions.map((action) => (
              <Link
                key={action.title}
                to={action.to}
                className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <action.icon className="mb-3 h-5 w-5 text-cyan-200" />
                {action.title}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
