import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Server, Key } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const SecurityFeature = ({ icon: Icon, title, desc, delay = 0 }) => (
  <div style={{ marginBottom: '2rem' }}>
    <PremiumCard color="#10B981" delay={delay} padding="2.5rem" noGlow={true}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <PremiumIconBox icon={Icon} color="#10B981" size={24} style={{ width: 52, height: 52, borderRadius: '12px', flexShrink: 0 }} />
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>{desc}</p>
        </div>
      </div>
    </PremiumCard>
  </div>
);

const SecurityPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Trust & Safety</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Enterprise-Grade Security
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Your retail data is your most valuable asset. We treat it that way.
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem 8rem' }}>
        <SecurityFeature 
          icon={Lock} title="JWT Authentication" 
          desc="All sessions are secured using JSON Web Tokens (JWT) and Flask-JWT-Extended. User credentials are securely hashed before storage, ensuring your account remains safe." 
          delay={0.1}
        />
        <SecurityFeature 
          icon={Server} title="Data Validation" 
          desc="Datasets uploaded to the platform undergo strict parsing and validation. We automatically drop empty rows, map schema types, and sanitize inputs before our ML pipelines process them." 
          delay={0.2}
        />
        <SecurityFeature 
          icon={Key} title="Role-Based Access Control (RBAC)" 
          desc="Ensure that only authorized personnel can view sensitive financial or marketing metrics. Define custom roles (Admin, Manager, Analyst, Viewer) directly in your dashboard." 
          delay={0.3}
        />
      </div>
    </MarketingLayout>
  );
};

export default SecurityPage;
