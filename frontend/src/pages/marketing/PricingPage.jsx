import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard } from '../../components/marketing/PremiumCard';

const PricingCard = ({ title, price, desc, features, notIncluded = [], popular = false, buttonText }) => (
  <PremiumCard isPrimary={popular} color={popular ? '#7C3AED' : '#2563EB'} padding="2.5rem" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {popular && (
        <div style={{
          position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #2563EB, #7C3AED)', color: 'white',
          padding: '6px 16px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', zIndex: 10
        }}>
          MOST POPULAR
        </div>
      )}
      
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: popular ? 'white' : '#0F172A', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
      <p style={{ fontSize: '0.85rem', color: popular ? 'rgba(255,255,255,0.8)' : '#64748B', marginTop: '0.5rem', minHeight: '40px' }}>{desc}</p>
      
      <div style={{ margin: '2rem 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: popular ? 'white' : '#0F172A', lineHeight: 1, fontFamily: "'Manrope', sans-serif" }}>
          {price === 'Free' ? 'Free' : `$${price}`}
        </span>
        {price !== 'Free' && <span style={{ fontSize: '1rem', color: popular ? 'rgba(255,255,255,0.7)' : '#64748B', fontWeight: 600 }}>/mo</span>}
      </div>

      <button style={{
        width: '100%', padding: '1rem', borderRadius: '12px',
        background: popular ? 'white' : '#F8FAFC',
        color: popular ? '#2563EB' : '#0F172A',
        border: popular ? 'none' : '1px solid #E2E8F0',
        fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
        marginBottom: '2rem', transition: 'all 0.2s',
        boxShadow: popular ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.05)'
      }}>
        {buttonText}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Check size={18} color={popular ? '#6EE7B7' : '#10B981'} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.9rem', color: popular ? 'white' : '#334155', fontWeight: 500 }}>{f}</span>
          </div>
        ))}
        {notIncluded.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: 0.5 }}>
            <X size={18} color={popular ? 'rgba(255,255,255,0.6)' : '#94A3B8'} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.9rem', color: popular ? 'rgba(255,255,255,0.7)' : '#64748B', textDecoration: 'line-through' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  </PremiumCard>
);

const PricingPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '700px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Simple Pricing</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Scale your retail intelligence.
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            No hidden fees, no complex tiers. Just transparent pricing that grows with your business.
          </p>
        </motion.div>
      </div>

      <div style={{ padding: '2rem 2rem 8rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <PricingCard 
            title="Starter"
            price="Free"
            desc="For single-store retailers getting started"
            buttonText="Get Started Free"
            features={[
              'Basic analytics dashboard',
              'Sales trend overview',
              'CSV dataset upload',
              'Standard PDF/CSV exports',
              '1 user seat'
            ]}
          />
          <PricingCard 
            title="Shop"
            price="9"
            desc="For small shops that want smarter daily decisions"
            popular={true}
            buttonText="Start Free Trial"
            features={[
              'Sales trends analysis',
              'Customer churn prediction',
              'Inventory forecasting',
              'Marketing segmentation',
              '2 user seats',
              'Priority email support'
            ]}
          />
          <PricingCard 
            title="Growth"
            price="29"
            desc="For growing retailers with multiple product categories"
            buttonText="Choose Growth"
            features={[
              'All AI modules unlocked',
              'Advanced dashboard insights',
              'Dataset history',
              'Report exports',
              'Up to 5 user seats',
              'Team collaboration'
            ]}
          />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
