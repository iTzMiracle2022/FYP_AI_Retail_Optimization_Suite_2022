import React from 'react';
import { motion } from 'framer-motion';
import MarketingLayout from '../../components/common/MarketingLayout';

const PrivacyPolicyPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Legal</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Last updated: October 2023
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 2rem 4rem', color: '#334155', lineHeight: 1.8 }}>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>1. Information We Collect</h2>
        <p style={{ marginBottom: '1rem' }}>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, and other information you choose to provide.</p>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>2. Data Security & AI Processing</h2>
        <p style={{ marginBottom: '1rem' }}>When you upload datasets (CSV) for AI analysis, the data is stored locally within the application's secure uploads directory. Our Machine Learning models process your data to generate aggregated predictive insights. We do not use your proprietary retail data to train foundational models or share it with external third parties.</p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginTop: '2rem', marginBottom: '1rem' }}>3. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at privacy@retailai.com.</p>
      </div>
    </MarketingLayout>
  );
};

export default PrivacyPolicyPage;
