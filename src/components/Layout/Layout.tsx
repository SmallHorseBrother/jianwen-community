import React, { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== 'POP' && !location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.search, location.hash, navigationType]);
  return (
    <div className="site-shell min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
      <Header />
      <main id="main-content" className="site-main relative w-full min-w-0 mx-auto flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
