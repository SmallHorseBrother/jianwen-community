Here's the fixed version with all missing closing brackets added:

```typescript
import React, { useState, useEffect } from 'react';
import { Clock, Target, Focus, ArrowLeft, Play, Pause, RotateCcw, Plus, X, CheckCircle, Circle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTasks, createTask, deleteTask, toggleTaskCompletion, Task } from '../../services/taskService';

const LearningToolbox: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="bg-white rounded-xl shadow-md p-8">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">需要登录才能使用学习工具</h2>
          <p className="text-gray-600 mb-6">
            枭马葛学习工具箱需要登录后才能使用，这样可以保存你的学习数据和进度。
          </p>
          <a
            href="/login"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            立即登录
          </a>
        </div>
      </div>
    );
  }

  const tools = [
    {
      id: 'pomodoro',
      title: '番茄钟',
      description: '25分钟专注工作，5分钟休息，科学提升学习效率',
      icon: Clock,
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'countdown',
      title: '任务倒计时',
      description: '设置截止日期，可视化时间紧迫感，避免拖延',
      icon: Target,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'focus',
      title: '专注模式',
      description: '极简界面，屏蔽一切干扰，进入深度学习状态',
      icon: Focus,
      color: 'from-purple-500 to-purple-600'
    }
  ];

  if (selectedTool === 'pomodoro') {
    return <PomodoroTimer onBack={() => setSelectedTool(null)} />;
  }

  if (selectedTool === 'countdown') {
    return <TaskCountdown onBack={() => setSelectedTool(null)} />;
  }

  if (selectedTool === 'focus') {
    return <FocusMode onBack={() => setSelectedTool(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">学习工具箱</h1>
        <p className="text-gray-600">
          理性学习，科学提效。枭马葛社区为你打造的专注学习工具集
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer p-6"
          >
            <div className={`w-16 h-16 bg-gradient-to-r ${tool.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <tool.icon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{tool.title}</h3>
            <p className="text-gray-600 text-sm">{tool.description}</p>
          </div>
        ))}
      </div>

      {/* 枭马葛理念展示 */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">枭马葛学习理念</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <Clock className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">科学管理时间</h3>
            <p className="text-gray-600 text-sm">基于科学研究的时间管理方法，提升学习效率</p>
          </div>
          <div className="text-center">
            <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">理性设定目标</h3>
            <p className="text-gray-600 text-sm">明确目标，量化进度，用数据驱动学习</p>
          </div>
          <div className="text-center">
            <Focus className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">深度专注思考</h3>
            <p className="text-gray-600 text-sm">摒弃浮躁，培养深度思考的能力</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningToolbox;
``` 