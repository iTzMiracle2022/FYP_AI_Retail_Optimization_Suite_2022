import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import LogoWhite from '../../assets/Logo/retail-ai-suite-logo-white-horizontal.svg';
import './MarketingFooter.css';

const FooterLink = ({ to, children, isRoadmap }) => (
  <Link to={to} className={isRoadmap ? 'footer-roadmap-link' : 'footer-link'}>
    {children} {isRoadmap ? <ArrowRight size={14} className="link-arrow" /> : <span className="link-arrow">→</span>}
  </Link>
);

const MarketingFooter = () => {
  return (
    <footer className="marketing-footer">
      <div className="footer-top-border" />
      <div style={{ maxWidth: '1120px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '3rem', marginBottom: '3rem'
        }}>
          {/* Brand */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem' }}>
              <img src={LogoWhite} alt="Retail AI Suite" className="footer-logo" />
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '280px' }}>
              Built for intelligent retail decisions. Forecast demand, predict churn, and grow revenue with AI-powered analytics.
            </p>
          </motion.div>

          {/* Product */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} viewport={{ once: true }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#CBD5E1', marginBottom: '1.25rem' }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <FooterLink to="/features">Features</FooterLink>
              <FooterLink to="/pricing">Pricing</FooterLink>
              <FooterLink to="/solutions">Solutions</FooterLink>
              <FooterLink to="/docs">Documentation</FooterLink>
            </div>
          </motion.div>

          {/* Company */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#CBD5E1', marginBottom: '1.25rem' }}>Company</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <FooterLink to="/about">About Us</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
              <FooterLink to="/roadmap" isRoadmap>Future Roadmap</FooterLink>
              <FooterLink to="/help">Help Center</FooterLink>
              <FooterLink to="/security">Security</FooterLink>
            </div>
          </motion.div>

          {/* Legal */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} viewport={{ once: true }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#CBD5E1', marginBottom: '1.25rem' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
              <FooterLink to="/terms">Terms of Service</FooterLink>
            </div>
          </motion.div>
        </div>

        <motion.div className="footer-bottom" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }} viewport={{ once: true }}>
          <p style={{ color: '#64748B', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
             © {new Date().getFullYear()} Retail AI Suite. All rights reserved.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: '#64748B', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16} color="#10B981" /> Secure Platform</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={16} color="#3B82F6" /> High Performance</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
