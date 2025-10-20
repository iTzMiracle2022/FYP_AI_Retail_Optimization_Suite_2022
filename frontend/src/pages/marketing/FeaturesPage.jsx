import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Users, Box, TrendingUp, Search, Zap, Shield, Sparkles } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const FeatureCard = ({ icon: Icon, title, desc, color, delay }) => (
  <PremiumCard color={color} delay={delay} padding="2.5rem">
    <PremiumIconBox icon={Icon} color={color} size={24} style={{ width: 52, height: 52, borderRadius: '16px', marginBottom: '1.25rem' }} />
    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
    <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.7 }}>{desc}</p>
  </PremiumCard>
);

const FeaturesPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Platform Features</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Everything you need to master your retail data.
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Retail AI Suite replaces fragmented spreadsheets and legacy BI tools with a unified, 
            AI-powered platform designed specifically for modern retail challenges.
          </p>
        </motion.div>
      </div>

      <div style={{ padding: '4rem 2rem 8rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <FeatureCard icon={LineChart} title="Sales Trend Analysis" desc="Discover revenue patterns, top products, and seasonal trends with interactive time-series visualizations. Export directly to stakeholder reports." color="#2563EB" delay={0.1} />
          <FeatureCard icon={Users} title="Customer Churn Prediction" desc="Identify at-risk customers before they leave using machine learning behavioral analysis. Automatically trigger retention workflows." color="#7C3AED" delay={0.2} />
          <FeatureCard icon={Box} title="Inventory Forecasting" desc="AI-powered demand prediction with automated reorder alerts and stock optimization to prevent deadstock and stockouts." color="#D97706" delay={0.3} />
          <FeatureCard icon={TrendingUp} title="Marketing Segmentation" desc="Cluster customers by spending, frequency, and sentiment for targeted campaigns. Stop guessing and start converting." color="#06B6D4" delay={0.4} />
          <FeatureCard icon={Search} title="Data Explorer" desc="Connect to disparate datasets and let our AI automatically clean, map, and harmonize the schemas for instant querying." color="#10B981" delay={0.5} />
          <FeatureCard icon={Zap} title="Real-time Alerts" desc="Set up custom threshold triggers to get instantly notified on Slack or Email when sales drop or inventory dips below minimums." color="#EF4444" delay={0.6} />
          <FeatureCard icon={Shield} title="Role-Based Access" desc="Granular Role-Based Access Control (RBAC) ensures your team only sees what they need to see. Assign System Admin, Manager, or Analyst roles." color="#64748B" delay={0.7} />
          <FeatureCard icon={Sparkles} title="Smart Data Cleaning" desc="Automatically handles missing values and maps your CSV columns to our internal AI schema during the upload process." color="#F59E0B" delay={0.8} />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default FeaturesPage;
