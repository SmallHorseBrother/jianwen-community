import React, { useState, useEffect } from 'react';
import { Clock, Target, Focus, ArrowLeft, Play, Pause, RotateCcw, Plus, X } from 'lucide-react';

const LearningToolbox: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

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

// 番茄钟组件
const PomodoroTimer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive) {
      interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds(seconds - 1);
        } else if (minutes > 0) {
          setMinutes(minutes - 1);
          setSeconds(59);
        } else {
          // 时间到
          setIsActive(false);
          if (isBreak) {
            setIsBreak(false);
            setMinutes(25);
            setSessions(sessions + 1);
          } else {
            setIsBreak(true);
            setMinutes(5);
          }
          setSeconds(0);
          // 可以在这里添加提醒音
          alert(isBreak ? '休息时间结束！开始新的工作周期' : '工作时间结束！该休息了');
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, minutes, seconds, isBreak, sessions]);

  const toggle = () => {
    setIsActive(!isActive);
  };

  const reset = () => {
    setIsActive(false);
    setMinutes(isBreak ? 5 : 25);
    setSeconds(0);
  };

  const switchMode = () => {
    setIsActive(false);
    setIsBreak(!isBreak);
    setMinutes(isBreak ? 25 : 5);
    setSeconds(0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回工具箱</span>
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">番茄钟</h1>
        <p className="text-gray-600">
          基于番茄工作法，25分钟专注工作，5分钟休息放松
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center space-y-6">
          {/* 时间显示 */}
          <div className={`text-8xl font-mono font-bold ${isBreak ? 'text-green-600' : 'text-red-600'}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          {/* 模式指示 */}
          <div className="text-xl font-semibold">
            {isBreak ? (
              <span className="text-green-600">休息时间 🌱</span>
            ) : (
              <span className="text-red-600">专注工作 🍅</span>
            )}
          </div>

          {/* 会话计数 */}
          <div className="text-gray-600">
            已完成 {sessions} 个番茄时间
          </div>

          {/* 控制按钮 */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={toggle}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : isBreak
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isActive ? '暂停' : '开始'}</span>
            </button>

            <button
              onClick={reset}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              <span>重置</span>
            </button>

            <button
              onClick={switchMode}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <span>{isBreak ? '切换到工作' : '切换到休息'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-red-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-3">番茄工作法</h3>
        <div className="text-sm text-red-700 space-y-2">
          <p>• 专注工作25分钟，然后休息5分钟</p>
          <p>• 每完成4个番茄时间，休息15-30分钟</p>
          <p>• 工作期间专注一项任务，避免分心</p>
          <p>• 利用休息时间放松，为下一轮专注做准备</p>
        </div>
      </div>
    </div>
  );
};

// 任务倒计时组件
const TaskCountdown: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tasks, setTasks] = useState<Array<{id: number, name: string, deadline: string}>>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  const addTask = () => {
    if (newTaskName && newTaskDeadline) {
      setTasks([...tasks, {
        id: Date.now(),
        name: newTaskName,
        deadline: newTaskDeadline
      }]);
      setNewTaskName('');
      setNewTaskDeadline('');
    }
  };

  const removeTask = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date().getTime();
    const deadlineTime = new Date(deadline).getTime();
    const difference = deadlineTime - now;

    if (difference < 0) {
      return { expired: true, text: '已过期', color: 'text-red-600' };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    let color = 'text-green-600';
    if (days < 1) color = 'text-red-600';
    else if (days < 3) color = 'text-yellow-600';

    return {
      expired: false,
      text: `${days}天 ${hours}小时 ${minutes}分钟`,
      color
    };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回工具箱</span>
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">任务倒计时</h1>
        <p className="text-gray-600">
          设置任务截止日期，可视化时间紧迫感，提升执行力
        </p>
      </div>

      {/* 添加任务 */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">添加新任务</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="任务名称"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="datetime-local"
            value={newTaskDeadline}
            onChange={(e) => setNewTaskDeadline(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTask}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加</span>
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无任务，添加一个开始管理你的时间吧！</p>
          </div>
        ) : (
          tasks.map((task) => {
            const timeInfo = getTimeRemaining(task.deadline);
            return (
              <div key={task.id} className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{task.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      截止时间：{new Date(task.deadline).toLocaleString()}
                    </p>
                    <p className={`text-xl font-bold ${timeInfo.color}`}>
                      {timeInfo.expired ? '⚠️ ' : '⏰ '}
                      {timeInfo.text}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">使用建议</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>• 设置具体的截止日期和时间，增强紧迫感</p>
          <p>• 将大任务分解为小任务，分别设置截止日期</p>
          <p>• 绿色表示时间充裕，黄色提示需要关注，红色表示紧急</p>
          <p>• 定期查看倒计时，保持对时间的敏感度</p>
        </div>
      </div>
    </div>
  );
};

// 专注模式组件
const FocusMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [inFocusMode, setInFocusMode] = useState(false);
  const [focusText, setFocusText] = useState('开始专注学习');

  if (inFocusMode) {
    return (
      <div className="fixed inset-0 bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold">{focusText}</h1>
          <p className="text-xl text-gray-300">保持专注，屏蔽干扰</p>
          <button
            onClick={() => setInFocusMode(false)}
            className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            退出专注模式
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回工具箱</span>
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">专注模式</h1>
        <p className="text-gray-600">
          进入极简的专注界面，屏蔽一切干扰，实现深度学习
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="text-center space-y-6">
          <Focus className="w-16 h-16 text-purple-600 mx-auto" />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              专注提醒文字
            </label>
            <input
              type="text"
              value={focusText}
              onChange={(e) => setFocusText(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="输入你的专注目标"
            />
          </div>

          <button
            onClick={() => setInFocusMode(true)}
            className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium"
          >
            进入专注模式
          </button>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-purple-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-purple-800 mb-3">专注模式使用指南</h3>
        <div className="text-sm text-purple-700 space-y-2">
          <p>• 进入后将全屏显示，屏蔽所有干扰信息</p>
          <p>• 建议关闭其他应用和通知</p>
          <p>• 配合番茄钟使用效果更佳</p>
          <p>• 适合阅读、写作、思考等需要深度专注的学习活动</p>
        </div>
      </div>
    </div>
  );
};

export default LearningToolbox; 