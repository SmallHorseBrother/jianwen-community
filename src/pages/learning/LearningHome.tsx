import React from 'react';
import { Link } from 'react-router-dom';
import { Book, Users, Star, Clock } from 'lucide-react';

const LearningHome: React.FC = () => {
  const sections = [
    {
      icon: Book,
      title: '精华知识库',
      description: '系统整理的学习方法和经验分享',
      to: '/learning/knowledge',
      color: 'from-purple-500 to-purple-600',
      available: true,
    },
    {
      icon: Star,
      title: '学习资源推荐',
      description: '精选优质学习资源和工具',
      to: '/learning/resources',
      color: 'from-blue-500 to-blue-600',
      available: false,
    },
    {
      icon: Users,
      title: '学伴匹配',
      description: '寻找志同道合的学习伙伴',
      to: '/learning/partners',
      color: 'from-green-500 to-green-600',
      available: false,
    },
    {
      icon: Clock,
      title: '学习工具箱',
      description: '番茄钟、任务倒计时、专注模式等实用工具',
      to: '/learning/toolbox',
      color: 'from-orange-500 to-orange-600',
      available: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">学习专区</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          理性学习，科学提效。枭马葛社区助你培养批判性思维和深度学习能力
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

export default LearningHome;