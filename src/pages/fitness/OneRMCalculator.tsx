import React, { useState } from 'react';
import { Calculator, Info, TrendingUp, Activity, Scale, Target, ArrowLeft } from 'lucide-react';

const FitnessToolbox: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const tools = [
    {
      id: 'onerm',
      title: '1RM计算器',
      description: '计算最大重复次数，制定科学训练计划',
      icon: Calculator,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'bmr-tdee',
      title: 'BMR/TDEE计算器',
      description: '计算基础代谢率和每日总热量消耗',
      icon: Activity,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'body-fat',
      title: '体脂率计算器',
      description: '使用美国海军身体周长法估算体脂率',
      icon: Scale,
      color: 'from-purple-500 to-purple-600'
    }
  ];

  if (selectedTool === 'onerm') {
    return <OneRMCalculator onBack={() => setSelectedTool(null)} />;
  }

  if (selectedTool === 'bmr-tdee') {
    return <BMRTDEECalculator onBack={() => setSelectedTool(null)} />;
  }

  if (selectedTool === 'body-fat') {
    return <BodyFatCalculator onBack={() => setSelectedTool(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">💪 枭马葛健身工具箱</h1>
        <p className="text-gray-600">
          马健文（枭马葛）专业的健身计算工具，帮您制定科学的训练和营养计划
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

      {/* Feature Highlights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">工具特色</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">科学准确</h3>
            <p className="text-gray-600 text-sm">使用经过验证的专业公式，确保计算结果的准确性</p>
          </div>
          <div className="text-center">
            <Calculator className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">简单易用</h3>
            <p className="text-gray-600 text-sm">直观的界面设计，无需专业知识即可轻松使用</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">训练指导</h3>
            <p className="text-gray-600 text-sm">提供详细的训练建议和营养指导</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 1RM Calculator Component
const OneRMCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [bodyWeight, setBodyWeight] = useState('');
  const [exercise, setExercise] = useState('bench');
  const [result, setResult] = useState<number | null>(null);

  const exercises = [
    { id: 'bench', label: '卧推', needsBodyWeight: false },
    { id: 'squat', label: '深蹲', needsBodyWeight: false },
    { id: 'deadlift', label: '硬拉', needsBodyWeight: false },
    { id: 'overhead', label: '推举', needsBodyWeight: false },
    { id: 'pullup', label: '引体向上', needsBodyWeight: true },
    { id: 'dips', label: '臂屈伸', needsBodyWeight: true },
    { id: 'muscleup', label: '双力臂', needsBodyWeight: true },
  ];

  const calculateOneRM = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    const bw = parseFloat(bodyWeight);
    const currentExercise = exercises.find(ex => ex.id === exercise);
    
    if (w <= 0 || r <= 0 || r > 20) {
      alert('请输入有效的重量和次数（次数应在1-20之间）');
      return;
    }
    
    if (currentExercise?.needsBodyWeight && (bw <= 0 || isNaN(bw))) {
      alert('请输入有效的体重');
      return;
    }
    
    let oneRM: number;
    
    if (exercise === 'muscleup') {
      // 双力臂特殊公式: 0.5 x ( - ( weight ^ 2 - 294 x weight - 24 x bw x ((reps ^ 1.5) - 1) ^ 0.5 + 21600 ) ^ 0.5 + weight + 147 )
      const innerCalc = Math.pow(w, 2) - 294 * w - 24 * bw * Math.pow((Math.pow(r, 1.5) - 1), 0.5) + 21600;
      
      if (innerCalc < 0) {
        alert('输入参数超出公式适用范围，请检查数值');
        return;
      }
      
      oneRM = 0.5 * (-(Math.pow(innerCalc, 0.5)) + w + 147);
      
      if (oneRM < 0) {
        alert('计算结果异常，请检查输入参数');
        return;
      }
    } else if (currentExercise?.needsBodyWeight) {
      // 引体向上和臂屈伸: ((weight + bw) × (1 + (0.0333 × reps) + (36 / (37 - reps)) + reps ^ 0.1) / 3) - bw
      const epley = 1 + 0.0333 * r;
      const brzycki = 36 / (37 - r);
      const lombardi = Math.pow(r, 0.1);
      
      oneRM = ((w + bw) * (epley + brzycki + lombardi) / 3) - bw;
    } else {
      // 传统动作: weight × (1 + (0.0333 × reps) + (36 / (37 - reps)) + reps ^ 0.1) / 3
      const epley = 1 + 0.0333 * r;
      const brzycki = 36 / (37 - r);
      const lombardi = Math.pow(r, 0.1);
      
      oneRM = w * (epley + brzycki + lombardi) / 3;
    }
    
    setResult(Math.round(oneRM * 10) / 10);
  };

  const getPercentageTable = () => {
    if (!result) return [];
    
    const percentages = [95, 90, 85, 80, 75, 70, 65, 60];
    return percentages.map(percent => ({
      percent,
      weight: Math.round(result * (percent / 100) * 10) / 10,
      reps: getRecommendedReps(percent),
    }));
  };

  const getRecommendedReps = (percent: number) => {
    if (percent >= 90) return '1-3';
    if (percent >= 85) return '3-5';
    if (percent >= 80) return '5-8';
    if (percent >= 75) return '8-10';
    if (percent >= 70) return '10-12';
    return '12+';
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">💪 枭马葛1RM计算器</h1>
        <p className="text-gray-600">
          马健文（枭马葛）1RM计算器 - 计算你的最大重复次数，制定更科学的训练计划
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calculator */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">计算1RM</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择动作
              </label>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.label}</option>
                ))}
              </select>
            </div>

            {exercises.find(ex => ex.id === exercise)?.needsBodyWeight && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  体重 (kg)
                </label>
                <input
                  type="number"
                  value={bodyWeight}
                  onChange={(e) => setBodyWeight(e.target.value)}
                  placeholder="输入体重"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {exercises.find(ex => ex.id === exercise)?.needsBodyWeight ? '负重 (kg)' : '重量 (kg)'}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={exercises.find(ex => ex.id === exercise)?.needsBodyWeight ? "输入负重（0表示徒手）" : "输入重量"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                次数
              </label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="输入次数"
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={calculateOneRM}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              计算1RM
            </button>

            {result && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">计算结果</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {result} kg
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  你的{exercises.find(ex => ex.id === exercise)?.label}1RM预估值
                  {exercises.find(ex => ex.id === exercise)?.needsBodyWeight && (
                    <span className="block text-xs mt-1">
                      （负重重量，不包含体重）
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Training Percentages */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Info className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">训练强度参考</h2>
          </div>

          {result ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">强度</th>
                    <th className="text-left py-2">重量 (kg)</th>
                    <th className="text-left py-2">建议次数</th>
                  </tr>
                </thead>
                <tbody>
                  {getPercentageTable().map(row => (
                    <tr key={row.percent} className="border-b">
                      <td className="py-2 font-medium">{row.percent}%</td>
                      <td className="py-2">{row.weight}</td>
                      <td className="py-2">{row.reps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>计算1RM后将显示训练强度参考表</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-yellow-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-3">使用说明</h3>
        <ul className="space-y-2 text-sm text-yellow-700">
          <li>• 1RM（One Rep Max）是指在标准动作下能够完成一次完整重复的最大重量</li>
          <li>• <strong>传统动作</strong>：使用三种经典公式的平均值，结果更加精确</li>
          <li>• <strong>自重负重动作</strong>：引体向上、臂屈伸需要输入体重，结果为负重重量</li>
          <li>• <strong>双力臂</strong>：使用专业公式，考虑体重对动作的巨大影响</li>
          <li>• 建议使用3-8次的重量进行计算，准确性更高</li>
          <li>• 计算结果仅供参考，实际训练请根据个人情况调整</li>
          <li>• 新手建议在有经验的教练指导下进行大重量训练</li>
        </ul>
      </div>

      {/* Formula Section */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">计算公式</h3>
        <div className="space-y-4 text-sm text-blue-700">
          
          {/* 传统动作公式 */}
          <div>
            <p className="font-medium mb-2">传统动作（卧推、深蹲、硬拉、推举）：</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div className="bg-white p-3 rounded-lg">
                <p className="font-medium text-blue-900">Epley公式</p>
                <p className="text-xs">重量 × (1 + 0.0333 × 次数)</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="font-medium text-blue-900">Brzycki公式</p>
                <p className="text-xs">重量 × (36 / (37 - 次数))</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="font-medium text-blue-900">Lombardi公式</p>
                <p className="text-xs">重量 × 次数^0.1</p>
              </div>
            </div>
            <p className="text-xs italic">
              最终结果 = (Epley + Brzycki + Lombardi) / 3
            </p>
          </div>

          {/* 自重负重动作公式 */}
          <div>
            <p className="font-medium mb-2">自重负重动作（引体向上、臂屈伸）：</p>
            <div className="bg-white p-3 rounded-lg">
              <p className="font-medium text-blue-900">修正公式</p>
              <p className="text-xs">((负重 + 体重) × 三种公式平均值) - 体重</p>
              <p className="text-xs text-gray-600 mt-1">
                考虑体重影响，结果为负重重量
              </p>
            </div>
          </div>

          {/* 双力臂公式 */}
          <div>
            <p className="font-medium mb-2">双力臂（特殊公式）：</p>
            <div className="bg-white p-3 rounded-lg">
              <p className="font-medium text-blue-900">专业公式</p>
              <p className="text-xs">基于顶级体操运动员数据插值得出</p>
              <p className="text-xs text-gray-600 mt-1">
                考虑体重对双力臂的巨大影响
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// BMR/TDEE Calculator Component
const BMRTDEECalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('1.2');
  const [bmr, setBmr] = useState<number | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);

  const activityLevels = [
    { value: '1.2', label: '久坐/基本无运动', description: '办公室工作，很少或没有锻炼' },
    { value: '1.375', label: '轻度活动', description: '每周1-3天轻度运动' },
    { value: '1.55', label: '中度活动', description: '每周3-5天中度运动' },
    { value: '1.725', label: '高度活动', description: '每周6-7天剧烈运动' },
    { value: '1.9', label: '极度活动', description: '体力劳动或每天剧烈运动' },
  ];

  const calculateBMRTDEE = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);
    const activity = parseFloat(activityLevel);

    if (w <= 0 || h <= 0 || a <= 0) {
      alert('请输入有效的数值');
      return;
    }

    // Mifflin-St Jeor公式
    let bmrResult: number;
    if (gender === 'male') {
      bmrResult = (10 * w) + (6.25 * h) - (5 * a) + 5;
    } else {
      bmrResult = (10 * w) + (6.25 * h) - (5 * a) - 161;
    }

    const tdeeResult = bmrResult * activity;

    setBmr(Math.round(bmrResult));
    setTdee(Math.round(tdeeResult));
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">💪 枭马葛BMR/TDEE计算器</h1>
        <p className="text-gray-600">
          马健文（枭马葛）代谢计算器 - 计算基础代谢率和每日总热量消耗，制定合理的营养计划
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calculator */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Activity className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">计算BMR/TDEE</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">年龄</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="输入年龄"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">体重 (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="输入体重"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">身高 (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="输入身高"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">活动水平</label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {activityLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label} - {level.description}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={calculateBMRTDEE}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              计算BMR/TDEE
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">计算结果</h2>
          </div>

          {bmr && tdee ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">基础代谢率 (BMR)</h3>
                <p className="text-2xl font-bold text-green-600">{bmr} 卡路里/天</p>
                <p className="text-sm text-green-700 mt-1">静息状态下的热量消耗</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">每日总热量消耗 (TDEE)</h3>
                <p className="text-2xl font-bold text-blue-600">{tdee} 卡路里/天</p>
                <p className="text-sm text-blue-700 mt-1">包含活动在内的总热量消耗</p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">营养建议</h3>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>• 减脂：{Math.round(tdee * 0.8)} - {Math.round(tdee * 0.9)} 卡路里/天</p>
                  <p>• 维持：{tdee} 卡路里/天</p>
                  <p>• 增肌：{Math.round(tdee * 1.1)} - {Math.round(tdee * 1.2)} 卡路里/天</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>输入信息后将显示计算结果</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-green-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-3">关于BMR和TDEE</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
          <div>
            <p className="font-medium mb-2">BMR（基础代谢率）</p>
            <p>指人体在静息状态下维持基本生命活动所需的最低热量消耗，使用Mifflin-St Jeor公式计算。</p>
          </div>
          <div>
            <p className="font-medium mb-2">TDEE（每日总热量消耗）</p>
            <p>BMR与活动系数的乘积，表示一天中的总热量消耗，是制定营养计划的重要依据。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Body Fat Calculator Component
const BodyFatCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gender, setGender] = useState('male');
  const [height, setHeight] = useState('');
  const [neck, setNeck] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculateBodyFat = () => {
    const h = parseFloat(height);
    const n = parseFloat(neck);
    const w = parseFloat(waist);
    const hi = parseFloat(hip);

    if (h <= 0 || n <= 0 || w <= 0) {
      alert('请输入有效的数值');
      return;
    }

    if (gender === 'female' && (hi <= 0 || isNaN(hi))) {
      alert('女性需要输入臀围');
      return;
    }

    let bodyFatPercentage: number;

    if (gender === 'male') {
      // 男性公式: 86.010 × log10(腰围 - 颈围) - 70.041 × log10(身高) + 36.76
      bodyFatPercentage = 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76;
    } else {
      // 女性公式: 163.205 × log10(腰围 + 臀围 - 颈围) - 97.684 × log10(身高) - 78.387
      bodyFatPercentage = 163.205 * Math.log10(w + hi - n) - 97.684 * Math.log10(h) - 78.387;
    }

    setResult(Math.round(bodyFatPercentage * 10) / 10);
  };

  const getBodyFatCategory = (percentage: number) => {
    if (gender === 'male') {
      if (percentage < 6) return { category: '过低', color: 'text-red-600' };
      if (percentage < 14) return { category: '运动员', color: 'text-blue-600' };
      if (percentage < 18) return { category: '健康', color: 'text-green-600' };
      if (percentage < 25) return { category: '平均', color: 'text-yellow-600' };
      return { category: '过高', color: 'text-red-600' };
    } else {
      if (percentage < 16) return { category: '过低', color: 'text-red-600' };
      if (percentage < 21) return { category: '运动员', color: 'text-blue-600' };
      if (percentage < 25) return { category: '健康', color: 'text-green-600' };
      if (percentage < 32) return { category: '平均', color: 'text-yellow-600' };
      return { category: '过高', color: 'text-red-600' };
    }
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">💪 枭马葛体脂率计算器</h1>
        <p className="text-gray-600">
          马健文（枭马葛）体脂计算器 - 使用美国海军身体周长法估算体脂率
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calculator */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Scale className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">计算体脂率</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">身高 (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="输入身高"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">颈围 (cm)</label>
              <input
                type="number"
                value={neck}
                onChange={(e) => setNeck(e.target.value)}
                placeholder="在喉结下方测量"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                腰围 (cm) - {gender === 'male' ? '肚脐水平' : '腹部最窄处'}
              </label>
              <input
                type="number"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                placeholder="输入腰围"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {gender === 'female' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">臀围 (cm)</label>
                <input
                  type="number"
                  value={hip}
                  onChange={(e) => setHip(e.target.value)}
                  placeholder="臀部最宽处"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            <button
              onClick={calculateBodyFat}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              计算体脂率
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">计算结果</h2>
          </div>

          {result !== null ? (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">体脂率</h3>
                <p className="text-2xl font-bold text-purple-600">{result}%</p>
                <p className={`text-sm mt-1 ${getBodyFatCategory(result).color}`}>
                  {getBodyFatCategory(result).category}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">体脂率参考标准</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  {gender === 'male' ? (
                    <>
                      <p>• 过低：&lt; 6%</p>
                      <p>• 运动员：6-13%</p>
                      <p>• 健康：14-17%</p>
                      <p>• 平均：18-24%</p>
                      <p>• 过高：&gt; 25%</p>
                    </>
                  ) : (
                    <>
                      <p>• 过低：&lt; 16%</p>
                      <p>• 运动员：16-20%</p>
                      <p>• 健康：21-24%</p>
                      <p>• 平均：25-31%</p>
                      <p>• 过高：&gt; 32%</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>输入测量数据后将显示计算结果</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-purple-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-purple-800 mb-3">测量说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-700">
          <div>
            <p className="font-medium mb-2">测量要求</p>
            <ul className="space-y-1">
              <li>• 使用软尺测量，保持水平</li>
              <li>• 不要过紧或过松</li>
              <li>• 测量时保持正常呼吸</li>
              <li>• 建议晨起空腹测量</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-2">注意事项</p>
            <ul className="space-y-1">
              <li>• 结果仅供参考</li>
              <li>• 不适用于孕妇和儿童</li>
              <li>• 肌肉量大的人群可能偏高</li>
              <li>• 建议结合其他指标综合判断</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FitnessToolbox;