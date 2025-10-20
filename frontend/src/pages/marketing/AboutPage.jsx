import React from 'react';
import { motion } from 'framer-motion';
import MarketingLayout from '../../components/common/MarketingLayout';

const AboutPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Our Story</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            About Retail AI
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            We believe that every retailer, regardless of size, deserves access to enterprise-grade artificial intelligence.
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem 8rem', color: '#334155', lineHeight: 1.8, fontSize: '1.05rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>Our Mission</h2>
        <p style={{ marginBottom: '2rem' }}>
          Retail data is historically messy. Spreadsheets, legacy point-of-sale systems, and disconnected marketing platforms create a nightmare for store owners trying to understand their business. Our mission is to bridge the gap between raw data and actionable intelligence.
        </p>

        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>The Team</h2>
        <p style={{ marginBottom: '2rem' }}>
          Retail AI Suite was built by a team of data scientists and retail veterans who were tired of seeing businesses fail simply because they couldn't predict inventory shifts or customer churn. We built the platform we wished we had.
        </p>
      </div>
    </MarketingLayout>
  );
};

export default AboutPage;
