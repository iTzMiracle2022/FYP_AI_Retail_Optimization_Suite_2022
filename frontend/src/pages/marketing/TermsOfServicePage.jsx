import React from 'react';
import { motion } from 'framer-motion';
import MarketingLayout from '../../components/common/MarketingLayout';

const TermsOfServicePage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Legal</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Last updated: October 2023
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 2rem 4rem', color: '#334155', lineHeight: 1.8 }}>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: '1rem' }}>By accessing or using the Retail AI Suite platform, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.</p>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>2. Acceptable Use</h2>
        <p style={{ marginBottom: '1rem' }}>You agree not to misuse the Retail AI Suite platform. Attempting to reverse-engineer the predictive ML models, bypass authentication, or upload malicious datasets will result in immediate termination of your account.</p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>3. Disclaimer of Warranties</h2>
        <p>The predictive analytics, churn forecasts, and inventory recommendations provided by Retail AI are estimations based on historical data. We do not guarantee future retail performance or revenue.</p>
      </div>
    </MarketingLayout>
  );
};

export default TermsOfServicePage;
