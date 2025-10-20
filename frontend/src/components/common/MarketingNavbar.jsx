import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { Menu, X, ArrowRight, ChevronDown } from 'lucide-react';
import LogoHorizontal from '../../assets/Logo/retail-ai-suite-logo-color-horizontal.svg';
import './MarketingNavbar.css';

const NavDropdown = ({ label, items }) => {
  return (
    <div className="nav-dropdown-wrapper">
      <div className="nav-link">
        {label} <ChevronDown size={14} />
      </div>
      <div className="nav-dropdown-panel">
        {items.map((item) => (
          <Link key={item.label} to={item.href} className="dropdown-item">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

const MarketingNavbar = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`marketing-navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={LogoHorizontal} alt="Retail AI Suite" style={{ height: '36px' }} />
        </Link>

        <div className="nav-links">
          <NavLink to="/features" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Features
          </NavLink>
          
          <NavLink to="/solutions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Solutions
          </NavLink>
          
          <NavLink to="/pricing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Pricing
          </NavLink>
          
          <NavDropdown 
            label="Documentation" 
            items={[
              { label: 'Docs', href: '/docs' },
              { label: 'Help Center', href: '/help' },
              { label: 'Security', href: '/security' },
            ]} 
          />
        </div>

        <div className="nav-btns-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/login" className="nav-signin-btn">
            Sign In
          </Link>
          <Link to="/signup" className="nav-cta-btn">
            Get Started <ArrowRight size={14} className="nav-cta-arrow" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="landing-mobile-btn" onClick={() => setMobileMenu(!mobileMenu)} style={{
          display: 'none', background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer'
        }}>
          {mobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mobile-menu-panel"
          >
            {['Features', 'Solutions', 'Pricing', 'Documentation'].map(l => (
              <Link key={l} to={`/${l.toLowerCase() === 'documentation' ? 'docs' : l.toLowerCase()}`} onClick={() => setMobileMenu(false)}
                style={{ color: '#334155', fontSize: '1rem', fontWeight: 600, textDecoration: 'none', padding: '0.25rem 0' }}>{l}</Link>
            ))}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={() => { setMobileMenu(false); navigate('/login'); }} style={{ width: '100%', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
              <button onClick={() => { setMobileMenu(false); navigate('/signup'); }} style={{ width: '100%', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', padding: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Get Started</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MarketingNavbar;
