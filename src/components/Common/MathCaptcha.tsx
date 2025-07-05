import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface MathCaptchaProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

const MathCaptcha: React.FC<MathCaptchaProps> = ({ onVerify, className = '' }) => {
  const [problem, setProblem] = useState({ question: '', answer: 0 });
  const [userAnswer, setUserAnswer] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // 生成随机数学题
  const generateProblem = () => {
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let num1: number, num2: number, answer: number, question: string;
    
    switch (operator) {
      case '+':
        num1 = Math.floor(Math.random() * 50) + 1;
        num2 = Math.floor(Math.random() * 50) + 1;
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 50) + 25; // 确保结果为正
        num2 = Math.floor(Math.random() * 24) + 1;
        answer = num1 - num2;
        question = `${num1} - ${num2}`;
        break;
      case '*':
        num1 = Math.floor(Math.random() * 12) + 1;
        num2 = Math.floor(Math.random() * 12) + 1;
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
      default:
        num1 = 1;
        num2 = 1;
        answer = 2;
        question = '1 + 1';
    }
    
    setProblem({ question, answer });
    setUserAnswer('');
    setIsValid(false);
    setShowFeedback(false);
    onVerify(false);
  };

  // 验证答案
  const checkAnswer = (value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      setIsValid(false);
      setShowFeedback(false);
      onVerify(false);
      return;
    }
    
    const valid = numValue === problem.answer;
    setIsValid(valid);
    setShowFeedback(true);
    onVerify(valid);
    
    // 3秒后隐藏反馈
    setTimeout(() => setShowFeedback(false), 3000);
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserAnswer(value);
    
    if (value.trim() !== '') {
      checkAnswer(value);
    } else {
      setIsValid(false);
      setShowFeedback(false);
      onVerify(false);
    }
  };

  // 组件挂载时生成验证码
  useEffect(() => {
    generateProblem();
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        数学验证码
      </label>
      <div className="flex items-center space-x-2">
        <div className="flex-1 flex items-center space-x-2">
          <div className="bg-gray-100 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 font-mono text-lg font-bold text-gray-800 min-w-[120px] text-center">
            {problem.question} = ?
          </div>
          <input
            type="text"
            value={userAnswer}
            onChange={handleInputChange}
            placeholder="答案"
            className={`w-20 px-3 py-2 border rounded-lg text-center font-mono text-lg focus:outline-none focus:ring-2 ${
              showFeedback
                ? isValid
                  ? 'border-green-500 bg-green-50 focus:ring-green-500'
                  : 'border-red-500 bg-red-50 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={generateProblem}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="刷新验证码"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {showFeedback && (
        <div className={`text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          {isValid ? '✓ 验证通过' : '✗ 答案错误，请重试'}
        </div>
      )}
    </div>
  );
};

export default MathCaptcha; 