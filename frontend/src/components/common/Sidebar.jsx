import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Box, BarChart2, 
  Settings, LogOut, ChevronRight, 
  Menu, X, TrendingUp, LineChart, UploadCloud,
  Database, FileText, Plug, ChevronLeft, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import LogoHorizontal from '../../assets/Logo/retail-ai-suite-logo-color-horizontal.svg';
import LogoIcon from '../../assets/Logo/retail-ai-suite-icon-color.svg';

const NavItem = ({ to, icon: Icon, label, exact = false, roles, onClick, isCollapsed }) => {
  const { user } = useAuth();
  if (roles && !roles.includes(user?.role)) return null;

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) => `nav-item-3d ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
    >
      <div className="nav-icon-wrapper">
        <Icon size={18} />
      </div>
      <span className="nav-label">{label}</span>
      <ChevronRight size={14} className="nav-arrow" />
    </NavLink>
  );
};

const SectionLabel = ({ text, roles, isCollapsed }) => {
  const { user } = useAuth();
  if (roles && !roles.includes(user?.role)) return null;
  if (isCollapsed) return <div style={{ height: '24px' }} />;
  return <div className="sidebar-section-label">{text}</div>;
};

const Sidebar = ({ isCollapsed, toggleCollapse }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button className="mobile-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.2)',
              backdropFilter: 'blur(4px)', zIndex: 999,
              display: window.innerWidth > 1024 ? 'none' : 'block'
            }}
          />
        )}
      </AnimatePresence>

      <aside className={`floating-glass-sidebar ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div 
            className="sidebar-brand" 
            onClick={toggleCollapse}
            style={{ 
              display: 'flex', alignItems: 'center', width: '100%', gap: '10px',
              cursor: 'pointer'
            }}
            title="Toggle Sidebar"
          >
            {isCollapsed ? (
                <img src={LogoIcon} alt="Retail AI" style={{ height: '28px', margin: '0 auto', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
            ) : (
                <img src={LogoHorizontal} alt="Retail AI Suite" style={{ height: '28px', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
            )}
          </div>
          
          {user && !isCollapsed && (
            <div className="user-profile-mini">
              <div className="avatar-placeholder">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="user-name">{user.name}</p>
                <p className="user-role">{user.role}</p>
              </div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav-scroll">
          <SectionLabel text="Overview" isCollapsed={isCollapsed} />
          <NavItem to="/dashboard"  icon={LayoutDashboard} label="Dashboard" onClick={closeSidebar} isCollapsed={isCollapsed} />
          <NavItem to="/upload"    icon={Database}         label="Data Hub" onClick={closeSidebar} roles={['Manager', 'System Admin']} isCollapsed={isCollapsed} />
          
          <SectionLabel text="AI Modules" roles={['System Admin', 'Manager', 'Analyst', 'Viewer']} isCollapsed={isCollapsed} />
          <NavItem to="/sales"     icon={LineChart}       label="Sales Trends" onClick={closeSidebar} roles={['System Admin', 'Manager', 'Viewer']} isCollapsed={isCollapsed} />
          <NavItem to="/churn"     icon={Users}           label="Customer Churn" onClick={closeSidebar} roles={['System Admin', 'Manager', 'Analyst']} isCollapsed={isCollapsed} />
          <NavItem to="/inventory" icon={Box}             label="Inventory Forecast" onClick={closeSidebar} roles={['System Admin', 'Manager']} isCollapsed={isCollapsed} />
          <NavItem to="/marketing" icon={TrendingUp}      label="Marketing Segments" onClick={closeSidebar} roles={['System Admin', 'Manager', 'Analyst']} isCollapsed={isCollapsed} />
          
          <SectionLabel text="Management" isCollapsed={isCollapsed} roles={['System Admin', 'Manager']} />
          <NavItem to="/analytics" icon={FileText}        label="Reports & Activity" onClick={closeSidebar} roles={['System Admin', 'Manager']} isCollapsed={isCollapsed} />
          {/* <NavItem to="/admin/connectors" icon={Plug}     label="Admin Connectors" onClick={closeSidebar} roles={['System Admin']} isCollapsed={isCollapsed} /> */}
          
          <SectionLabel text="Account" isCollapsed={isCollapsed} />
          <NavItem to="/settings"  icon={Settings}        label="Settings" onClick={closeSidebar} isCollapsed={isCollapsed} />
        </nav>

        <div className="sidebar-footer">
          <button onClick={logout} className="logout-btn-premium" title={isCollapsed ? "Sign Out" : undefined}>
            <LogOut size={16} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
