import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Import debug utilities (available in browser console as window.debugAuth)
import './lib/debugAuth';
import Layout from './components/Layout/Layout';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Profile from './pages/Profile';

// V2.0 新页面
import QAHome from './pages/QAHome';
import QADetail from './pages/QADetail';

import AdminDashboard from './pages/AdminDashboard';
import CommunityV2 from './pages/CommunityV2';
import Tools from './pages/Tools';

// 旧页面 (归档)
import Home from './pages/Home';
import FitnessHome from './pages/fitness/FitnessHome';
import FitnessKnowledge from './pages/fitness/FitnessKnowledge';
import FitnessToolbox from './pages/fitness/OneRMCalculator';
import LearningHome from './pages/learning/LearningHome';
import LearningKnowledge from './pages/learning/LearningKnowledge';
import LearningToolbox from './pages/learning/LearningToolbox';
import MatchingCenter from './pages/MatchingCenter';
import CommunityProfiles from './pages/CommunityProfiles';
import ComingSoon from './components/Common/ComingSoon';
import NotFound from './components/Common/NotFound';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
};

// App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ========== V2.0 核心路由 ========== */}
      {/* 主页 - Q&A 数字大脑 */}
      <Route path="/" element={<Layout><QAHome /></Layout>} />
      <Route path="/qa/:id" element={<Layout><QADetail /></Layout>} />
      
      {/* 社区广场 */}
      <Route path="/community" element={<Layout><CommunityV2 /></Layout>} />
      
      {/* 工具箱 */}
      <Route path="/tools" element={<Layout><Tools /></Layout>} />
      
      {/* 个人资料 */}
      <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      
      {/* 管理后台 */}
      <Route path="/admin" element={<ProtectedRoute><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
      {/* 保留旧路由重定向 */}
      <Route path="/admin/qa" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/suggestions" element={<Navigate to="/admin" replace />} />
      
      {/* 认证 */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      
      {/* ========== 旧版页面 (归档) ========== */}
      {/* 旧主页重定向 */}
      <Route path="/home" element={<Layout><Home /></Layout>} />
      
      {/* Fitness Routes (归档) */}
      <Route path="/fitness" element={<Layout><FitnessHome /></Layout>} />
      <Route path="/fitness/knowledge" element={<Layout><FitnessKnowledge /></Layout>} />
      <Route path="/fitness/calculator" element={<Layout><FitnessToolbox /></Layout>} />
      <Route path="/fitness/resources" element={<Layout><ComingSoon title="优质资源推荐" description="优质UP主、优质视频等内容整理中，敬请期待！" backTo="/fitness" /></Layout>} />
      <Route path="/fitness/profiles" element={<Layout><CommunityProfiles /></Layout>} />
      
      {/* Learning Routes (归档) */}
      <Route path="/learning" element={<Layout><LearningHome /></Layout>} />
      <Route path="/learning/knowledge" element={<Layout><LearningKnowledge /></Layout>} />
      <Route path="/learning/toolbox" element={<Layout><LearningToolbox /></Layout>} />
      <Route path="/learning/resources" element={<Layout><ComingSoon title="学习资源推荐" description="精选学习资源和工具整理中，敬请期待！" backTo="/learning" /></Layout>} />
      <Route path="/learning/partners" element={<Layout><MatchingCenter /></Layout>} />
      <Route path="/learning/tools" element={<Layout><ComingSoon title="学习工具" description="番茄钟、习惯打卡等实用功能正在路上！" backTo="/learning" /></Layout>} />
      
      {/* 旧社区路由重定向 */}
      <Route path="/community/profiles" element={<Navigate to="/community" replace />} />
      <Route path="/community/matching" element={<Navigate to="/community" replace />} />
      
      {/* 404 Page - must be last */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;