import React from 'react';
import { Link } from 'react-router-dom';
import { Book, Calculator, Star, Users } from 'lucide-react';

const FitnessHome: React.FC = () => {
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
      title: '1RM计算器',
      description: '快速计算你的最大重复次数',
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
      description: '展示社区大佬的训练数据',
      to: '/fitness/profiles',
      color: 'from-orange-500 to-orange-600',
      available: false,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">健身专区</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          科学健身，理性训练。这里有最系统的健身知识和最实用的训练工具
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