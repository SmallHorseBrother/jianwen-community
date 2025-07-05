import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Home from './pages/Home';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Profile from './pages/Profile';
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
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/" element={<Layout><Home /></Layout>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      
      {/* Fitness Routes */}
      <Route path="/fitness" element={<Layout><FitnessHome /></Layout>} />
      <Route path="/fitness/knowledge" element={<Layout><FitnessKnowledge /></Layout>} />
      <Route path="/fitness/calculator" element={<Layout><FitnessToolbox /></Layout>} />
      <Route path="/fitness/resources" element={<Layout><ComingSoon title="优质资源推荐" description="优质UP主、优质视频等内容整理中，敬请期待！" backTo="/fitness" /></Layout>} />
      <Route path="/fitness/profiles" element={<Layout><CommunityProfiles /></Layout>} />
      
      {/* Learning Routes */}
      <Route path="/learning" element={<Layout><LearningHome /></Layout>} />
      <Route path="/learning/knowledge" element={<Layout><LearningKnowledge /></Layout>} />
      <Route path="/learning/toolbox" element={<Layout><LearningToolbox /></Layout>} />
      <Route path="/learning/resources" element={<Layout><ComingSoon title="学习资源推荐" description="精选学习资源和工具整理中，敬请期待！" backTo="/learning" /></Layout>} />
      <Route path="/learning/partners" element={<Layout><MatchingCenter /></Layout>} />
      <Route path="/learning/tools" element={<Layout><ComingSoon title="学习工具" description="番茄钟、习惯打卡等实用功能正在路上！" backTo="/learning" /></Layout>} />
      
      {/* Community Routes */}
      <Route path="/community" element={<Layout><MatchingCenter /></Layout>} />
      <Route path="/community/profiles" element={<Layout><CommunityProfiles /></Layout>} />
      <Route path="/community/matching" element={<Layout><MatchingCenter /></Layout>} />
      
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