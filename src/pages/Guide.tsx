/**
 * 使用指南页面
 * 帮助新用户快速了解社区功能
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageCircle, Users, Wrench, User, Lightbulb, 
  ArrowRight, CheckCircle, Sparkles, ExternalLink
} from 'lucide-react';

interface GuideStep {
  step: number;
  title: string;
  description: string;
  action?: {
    label: string;
    to: string;
  };
}

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  link: string;
  color: string;
}

const Guide: React.FC = () => {
  const quickStartSteps: GuideStep[] = [
    {
      step: 1,
      title: '注册/登录账号',
      description: '使用手机号快速注册，或直接登录已有账号',
      action: { label: '去注册', to: '/register' }
    },
    {
      step: 2,
      title: '完善个人资料',
      description: '填写昵称、技能标签、需求等信息，让其他群友认识你',
      action: { label: '编辑资料', to: '/profile' }
    },
    {
      step: 3,
      title: '探索社区功能',
      description: '浏览问答、社区广场、工具箱等功能',
    }
  ];

  const features: Feature[] = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: 'Q&A 数字大脑',
      description: '向马健文提问，浏览精华问答。所有问答都会沉淀下来，随时可搜索查阅。',
      link: '/qa',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: '社区广场',
      description: '查看所有成员的社交名片，展示技能供需，找到志同道合的伙伴。点击名片可看完整信息。',
      link: '/community',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      title: '工具箱',
      description: '集成多款实用 AI 工具：会议总结助手、食物分析、健身计划等，还在持续更新中。',
      link: '/tools',
      color: 'from-green-500 to-emerald-600'
    },
    {
      icon: <User className="w-6 h-6" />,
      title: '个人档案',
      description: '管理个人信息：基础资料、健身数据、技能标签、社交链接等。完善资料让他人更好地了解你。',
      link: '/profile',
      color: 'from-purple-500 to-pink-600'
    },
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: '用户心声',
      description: '对社区有建议？在工具箱页面提交你的想法，和大家一起共建这个平台！',
      link: '/tools',
      color: 'from-yellow-500 to-orange-500'
    }
  ];

  const tips = [
    '完善个人资料后，你的名片才会出现在社区广场',
    '可以填写"我能提供"和"正在寻找"让技能匹配更精准',
    '登录后查看他人名片可以看到微信号等联系方式',
    '问答支持匿名提问，保护你的隐私',
    '工具箱里的 AI 工具都是免费使用的'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-16 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-6">📖</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            欢迎来到健文社区
          </h1>
          <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
            这是马健文（枭马葛）粉丝的专属社区，让我们一起健身、学习、成长
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors shadow-lg"
          >
            立即加入
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* 快速开始 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            三步快速上手
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickStartSteps.map((item) => (
              <div 
                key={item.step}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{item.description}</p>
                {item.action && (
                  <Link
                    to={item.action.to}
                    className="inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-700"
                  >
                    {item.action.label}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 功能介绍 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            🎯 核心功能
          </h2>
          <div className="space-y-4">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={feature.link}
                className="block bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-gray-500 text-sm">{feature.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 使用小贴士 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            💡 使用小贴士
          </h2>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <ul className="space-y-3">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 底部 CTA */}
        <section className="text-center bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">准备好了吗？</h2>
          <p className="text-indigo-100 mb-6">注册账号，开始你的见闻社区之旅</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
            >
              立即注册
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 border-2 border-white text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Guide;
