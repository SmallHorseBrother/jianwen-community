/**
 * 管理员统一后台 (Dashboard)
 * 整合 Q&A 和 建议箱管理
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MessageSquare, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkIsAdmin } from '../services/questionService';
import AdminQA from './AdminQA';
import AdminSuggestions from './AdminSuggestions';

type Tab = 'qa' | 'suggestions';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentTab, setCurrentTab] = useState<Tab>('qa');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate('/login', { state: { from: '/admin' } });
        return;
      }
      
      const admin = await checkIsAdmin(user.id);
      if (!admin) {
        alert('您没有管理员权限');
        navigate('/');
        return;
      }
      
      setIsAdmin(true);
      setLoading(false);
    };
    checkAccess();
  }, [user, navigate]);

  // Sync tab with URL query param optionally, or just internal state
  // For now simple internal state

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
              <span>管理后台</span>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setCurrentTab('qa')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  currentTab === 'qa'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Q&A 管理
              </button>
              <button
                onClick={() => setCurrentTab('suggestions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  currentTab === 'suggestions'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                建议箱管理
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pb-10">
        {/* We wrap children in a way that respects their internal layout but hides their headers if needed? 
            AdminQA and AdminSuggestions have their own headers. 
            Ideally we strictly refactor them to props `hideHeader={true}` but simple stacking is acceptable for MVP.
        */}
        {currentTab === 'qa' && (
          // Force override some styles if necessary via CSS modules or wrapping, 
          // but for now let's just render.
          <AdminQA />
        )}
        {currentTab === 'suggestions' && (
          <AdminSuggestions />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
