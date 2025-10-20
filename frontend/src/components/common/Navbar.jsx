import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

const Navbar = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
  const { inventoryState, marketingState, churnState } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const notifs = [
      { id: 'sys1', type: 'info', title: 'System Ready', message: 'AI predictive models are online.', time: 'Just now', read: false }
    ];
    
    if (inventoryState?.results?.low_stock_alerts?.length > 0) {
      notifs.unshift({
        id: 'inv1', type: 'alert', title: 'Low Stock Warnings', 
        message: `${inventoryState.results.low_stock_alerts.length} products require restock.`,
        time: 'Recent', read: false
      });
    }
    
    if (marketingState?.results?.clusters) {
      notifs.unshift({
        id: 'mkt1', type: 'success', title: 'Segmentation Complete', 
        message: `Generated ${marketingState.results.n_clusters} audience segments.`,
        time: 'Recent', read: false
      });
    }

    if (churnState?.results?.at_risk_customers > 0) {
      notifs.unshift({
        id: 'chr1', type: 'alert', title: 'Churn Risk Detected', 
        message: `Identified ${churnState.results.at_risk_customers} at-risk customers.`,
        time: 'Recent', read: false
      });
    }

    setNotifications(notifs);
  }, [inventoryState, marketingState, churnState]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({...n, read: true})));
  };

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '1px solid var(--border)',
      gap: '1.5rem',
      flexWrap: 'wrap'
    }}>
      <div style={{ flex: '1 1 0', minWidth: '300px' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 800, 
          color: 'var(--text-main)',
          letterSpacing: '-0.02em',
          margin: 0,
          fontFamily: "'Manrope', sans-serif"
        }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px', fontWeight: 500, lineHeight: 1.4 }}>
            {subtitle}
          </p>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', paddingRight: '1rem', borderRight: '1px solid var(--border)' }}>
            {actions}
          </div>
        )}
        
        {/* Notification Bell Dropdown Area */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            style={{ 
              background: 'var(--bg-secondary)', border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', padding: '8px', cursor: 'pointer', 
              color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', position: 'relative'
            }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '320px',
              background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', zIndex: 50, overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Mark all read</button>
                )}
              </div>
              
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div key={n.id} style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', opacity: n.read ? 0.6 : 1, transition: 'all 0.2s', cursor: 'pointer', background: n.read ? 'transparent' : '#F0F9FF' }}>
                    <div style={{ marginTop: '2px' }}>
                      {n.type === 'alert' && <AlertTriangle size={16} color="#EF4444" />}
                      {n.type === 'success' && <CheckCircle size={16} color="#10B981" />}
                      {n.type === 'info' && <Info size={16} color="#3B82F6" />}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{n.title}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>{n.message}</p>
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
