import React from 'react';
import { Link } from 'react-router-dom';
import { Book, Calculator, Star, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const FitnessHome: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="text-6xl mb-6">💪</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">需要登录才能使用健身功能</h2>
          <p className="text-gray-600 mb-6">
            枭马葛健身专区需要登录后才能使用，这样可以保存你的训练数据和进度。
          </p>
          <Link
            to="/login"
            state={{ from: window.location.pathname }}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            立即登录
          </Link>
        </div>
      </div>
    );
  }

  const sections = [
    {
      icon: Book,
      title: '精华知识库',
      description: '系统整理的健身知识，科学训练方法',
      to: '/fitness/knowledge',
      color: 'from-blue-500 to-blue-600',
      available: true,
    },
    {
      icon: Calculator,
      title: '健身工具箱',
      description: '专业计算工具：1RM、BMR/TDEE、体脂率计算器',
      to: '/fitness/calculator',
      color: 'from-green-500 to-green-600',
      available: true,
    },
    {
      icon: Star,
      title: '优质资源推荐',
      description: '精选健身UP主和优质视频',
      to: '/fitness/resources',
      color: 'from-purple-500 to-purple-600',
      available: false,
    },
    {
      icon: Users,
      title: '大佬卡片墙',
      description: '浏览社区成员的健身卡片，寻找训练伙伴',
      to: '/fitness/profiles',
      color: 'from-orange-500 to-orange-600',
      available: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">💪 枭马葛健身专区</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          科学健身，理性训练。枭马葛为你打造最系统的健身知识和最实用的训练工具
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, index) => (
          <Link
            key={index}
            to={section.to}
            className={`group p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ${
              section.available ? 'hover:-translate-y-1' : 'opacity-75'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 bg-gradient-to-r ${section.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <section.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                  <span>{section.title}</span>
                  {!section.available && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      开发中
                    </span>
                  )}
                </h3>
                <p className="text-gray-600">{section.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FitnessHome;