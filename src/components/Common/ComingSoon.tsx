import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ComingSoonProps {
  title: string;
  description: string;
  backTo?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, description, backTo = '/' }) => {
  return (
    <div className="text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Construction className="w-10 h-10 text-yellow-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-600 mb-8">{description}</p>
        <Link
          to={backTo}
          className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回首页</span>
        </Link>
      </div>
    </div>
  );
};

export default ComingSoon;