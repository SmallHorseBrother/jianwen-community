import React from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, BookOpen, Calculator, Users, Award, Target } from 'lucide-react';

const Home: React.FC = () => {
  const features = [
    {
      icon: Dumbbell,
      title: '健身精华',
      description: '系统整理的健身知识库，助你科学训练',
      to: '/fitness/knowledge',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Calculator,
      title: '1RM计算器',
      description: '快速计算你的最大重复次数',
      to: '/fitness/calculator',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: BookOpen,
      title: '学习资源',
      description: '精选学习资料和方法分享',
      to: '/learning/knowledge',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: Users,
      title: '社区连接',
      description: '与志同道合的朋友互相激励',
      to: '/community',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  const stats = [
    { number: '1000+', label: '社区成员' },
    { number: '500+', label: '精华内容' },
    { number: '200+', label: '活跃用户' },
    { number: '50+', label: '优质资源' },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            健学社区
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            健身与学习的专属根据地，让优质内容不再被淹没
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/fitness"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              开始健身之旅
            </Link>
            <Link
              to="/learning"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              探索学习资源
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">核心功能</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            我们致力于为健身和学习爱好者提供最优质的内容和工具
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.to}
              className="group p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-100 rounded-2xl p-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">社区数据</h2>
          <p className="text-gray-600">一起见证社区的成长</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stat.number}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            准备好开始你的健身学习之旅了吗？
          </h2>
          <p className="text-gray-600 mb-8">
            加入我们的社区，获取最优质的健身知识和学习资源
          </p>
          <Link
            to="/register"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <Target className="w-5 h-5" />
            <span>立即加入</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;