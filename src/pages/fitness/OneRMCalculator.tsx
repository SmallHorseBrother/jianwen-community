import React, { useState } from 'react';
import { Calculator, Info, TrendingUp } from 'lucide-react';

const OneRMCalculator: React.FC = () => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [exercise, setExercise] = useState('bench');
  const [result, setResult] = useState<number | null>(null);

  const exercises = [
    { id: 'bench', label: '卧推' },
    { id: 'squat', label: '深蹲' },
    { id: 'deadlift', label: '硬拉' },
    { id: 'overhead', label: '推举' },
  ];

  const calculateOneRM = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    
    if (w <= 0 || r <= 0 || r > 20) {
      alert('请输入有效的重量和次数（次数应在1-20之间）');
      return;
    }
    
    // 使用 Brzycki 公式: 1RM = weight / (1.0278 - 0.0278 × reps)
    const oneRM = w / (1.0278 - 0.0278 * r);
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
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">1RM计算器</h1>
        <p className="text-gray-600">
          计算你的最大重复次数（1RM），制定更科学的训练计划
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                重量 (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="输入重量"
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
          <li>• 建议使用3-8次的重量进行计算，准确性更高</li>
          <li>• 计算结果仅供参考，实际训练请根据个人情况调整</li>
          <li>• 新手建议在有经验的教练指导下进行大重量训练</li>
        </ul>
      </div>
    </div>
  );
};

export default OneRMCalculator;