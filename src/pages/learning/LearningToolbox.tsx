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

// Placeholder components for the tools
const PomodoroTimer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (isBreak) {
        setTimeLeft(25 * 60);
        setIsBreak(false);
      } else {
        setTimeLeft(5 * 60);
        setIsBreak(true);
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(25 * 60);
    setIsBreak(false);
  };

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回工具箱
      </button>
      
      <div className="bg-white rounded-xl shadow-lg p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {isBreak ? '休息时间' : '专注时间'}
        </h1>
        
        <div className="text-8xl font-mono font-bold text-red-600 mb-8">
          {formatTime(timeLeft)}
        </div>
        
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            {isRunning ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {isRunning ? '暂停' : '开始'}
          </button>
          
          <button
            onClick={resetTimer}
            className="flex items-center bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            重置
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskCountdown: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', deadline: '', description: '' });
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    try {
      const userTasks = await getUserTasks();
      setTasks(userTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTask.name || !newTask.deadline) return;

    try {
      await createTask({
        name: newTask.name,
        deadline: new Date(newTask.deadline).toISOString(),
        description: newTask.description,
        user_id: user.id
      });
      setNewTask({ name: '', deadline: '', description: '' });
      setShowAddForm(false);
      loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
      loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date().getTime();
    const deadlineTime = new Date(deadline).getTime();
    const difference = deadlineTime - now;

    if (difference <= 0) {
      return { expired: true, text: '已过期' };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return { expired: false, text: `${days}天 ${hours}小时` };
    } else if (hours > 0) {
      return { expired: false, text: `${hours}小时 ${minutes}分钟` };
    } else {
      return { expired: false, text: `${minutes}分钟` };
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回工具箱
      </button>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">任务倒计时</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            添加任务
          </button>
        </div>

        {showAddForm && (
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">任务名称</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">截止时间</label>
                <input
                  type="datetime-local"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  添加任务
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">还没有任务，点击上方按钮添加第一个任务吧！</p>
            </div>
          ) : (
            tasks.map((task) => {
              const timeRemaining = getTimeRemaining(task.deadline);
              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 ${
                    task.is_completed
                      ? 'bg-green-50 border-green-200'
                      : timeRemaining.expired
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {task.is_completed ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>
                      <div>
                        <h3 className={`font-semibold ${task.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {task.name}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-600">{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className={`font-semibold ${
                          timeRemaining.expired ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {timeRemaining.text}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(task.deadline).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const FocusMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [isActive, setIsActive] = useState(false);

  if (isActive) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Focus className="w-24 h-24 mx-auto mb-8 text-purple-400" />
          <h1 className="text-4xl font-bold mb-4">专注模式</h1>
          <p className="text-xl text-gray-300 mb-8">保持专注，远离干扰</p>
          <button
            onClick={() => setIsActive(false)}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            退出专注模式
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回工具箱
      </button>
      
      <div className="bg-white rounded-xl shadow-lg p-12">
        <Focus className="w-24 h-24 text-purple-600 mx-auto mb-8" />
        <h1 className="text-3xl font-bold text-gray-900 mb-4">专注模式</h1>
        <p className="text-gray-600 mb-8">
          进入专注模式后，界面将变为极简的全屏模式，帮助你屏蔽一切干扰，专心学习。
        </p>
        <button
          onClick={() => setIsActive(true)}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors"
        >
          开始专注
        </button>
      </div>
    </div>
  );
};

export default LearningToolbox;