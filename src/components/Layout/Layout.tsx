import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="cosmic-shell min-h-screen flex flex-col text-slate-100">
      <Header />
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 py-5 sm:px-6 sm:py-8 lg:px-8 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
