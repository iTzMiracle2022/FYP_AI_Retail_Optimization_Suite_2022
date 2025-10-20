import React, { useEffect } from 'react';
import MarketingNavbar from './MarketingNavbar';
import MarketingFooter from './MarketingFooter';
import SmoothScroll from './SmoothScroll';
import { useLocation } from 'react-router-dom';

const MarketingLayout = ({ children }) => {
  const { pathname } = useLocation();

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <SmoothScroll>
      <div style={{ background: '#FAFBFF', minHeight: '100vh', overflow: 'hidden' }}>
        <MarketingNavbar />
        
        {/* Main Content with padding for fixed navbar */}
        <main style={{ paddingTop: '80px', minHeight: 'calc(100vh - 300px)' }}>
          {children}
        </main>
        
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
};

export default MarketingLayout;
