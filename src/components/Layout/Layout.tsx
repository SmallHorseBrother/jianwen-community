import React from 'react';
import Header from './Header';
import Footer from './Footer';
import VisualAtmosphere from '../Common/VisualAtmosphere';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="cosmic-shell site-shell min-h-screen flex flex-col text-slate-100">
      <VisualAtmosphere />
      <div className="site-scroll-progress" aria-hidden="true" />
      <Header />
      <main className="site-main relative z-10 w-full min-w-0 max-w-[1480px] mx-auto px-3 py-4 sm:px-6 sm:py-8 lg:px-10 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
