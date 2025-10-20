import React from 'react';
import { motion } from 'framer-motion';
import { Target, Activity, Users, BarChart3 } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const SolutionCard = ({ icon: I, title, desc, color, delay }) => (
  <PremiumCard color={color} delay={delay} padding="3rem">
    <PremiumIconBox icon={I} color={color} size={28} style={{ width: 56, height: 56, borderRadius: '16px', marginBottom: '1.5rem' }} />
    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
    <p style={{ color: '#64748B', lineHeight: 1.7, fontSize: '1rem' }}>{desc}</p>
  </PremiumCard>
);

const SolutionsPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Business Solutions</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Built for every retail challenge.
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Whether you're struggling with deadstock, dropping retention rates, or poor 
            sales visibility, our AI models are pre-trained to solve your exact problems.
          </p>
        </motion.div>
      </div>

      <div style={{ padding: '4rem 2rem 8rem', maxWidth: '1200px', margin: '0 auto', background: '#FAFBFF' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          <SolutionCard 
            icon={Target} title="Predict & Prevent Churn" 
            desc="Our AI models track subtle shifts in purchasing behavior to flag at-risk customers before they leave. This gives your team the critical window needed to launch targeted win-back campaigns and retain valuable customer relationships." 
            color="#7C3AED" delay={0.1} 
          />
          <SolutionCard 
            icon={Activity} title="Automated Demand Forecasting" 
            desc="Stop guessing inventory. The platform ingests historical data and seasonal trends to calculate exact restock dates and optimal order quantities, ensuring you never miss a sale or pay for excess warehouse space." 
            color="#F59E0B" delay={0.2} 
          />
          <SolutionCard 
            icon={Users} title="Hyper-Personalized Segmentation" 
            desc="Automatically group your customer base using deep RFM (Recency, Frequency, Monetary) metrics. Understand exactly who your VIPs are and ensure your marketing dollars only target high-conversion cohorts." 
            color="#06B6D4" delay={0.3} 
          />
          <SolutionCard 
            icon={BarChart3} title="Crystal-Clear Intelligence" 
            desc="Abandon the messy spreadsheets. Instantly visualize revenue velocity, category performance, and profit margins through dynamic, real-time dashboards built specifically for retail executives." 
            color="#2563EB" delay={0.4} 
          />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default SolutionsPage;
