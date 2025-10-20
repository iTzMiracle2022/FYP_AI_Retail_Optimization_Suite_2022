import React from 'react';
import { motion } from 'framer-motion';
import { Search, Book, MessageCircle, PlayCircle } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const HelpCard = ({ icon: Icon, title, desc, delay = 0 }) => (
  <PremiumCard color="#3B82F6" delay={delay} padding="2.5rem" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <PremiumIconBox icon={Icon} color="#3B82F6" size={24} style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 1.5rem' }} />
    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
    <p style={{ color: '#64748B', fontSize: '0.9rem', lineHeight: 1.6 }}>{desc}</p>
  </PremiumCard>
);

const HelpCenterPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Knowledge Base</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            How can we help?
          </h1>
          <div style={{ position: 'relative', marginTop: '2rem' }}>
            <Search size={20} color="#94A3B8" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search for articles, guides, or features..." 
              style={{
                width: '100%', padding: '1.25rem 1.25rem 1.25rem 3.5rem',
                borderRadius: '16px', border: '1px solid #E2E8F0',
                fontSize: '1rem', outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            />
          </div>
        </motion.div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem 8rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <HelpCard icon={Book} title="Knowledge Base" desc="Detailed articles covering every feature in the Retail AI suite." delay={0.1} />
          <HelpCard icon={PlayCircle} title="Video Tutorials" desc="Step-by-step videos on setting up connectors and interpreting ML charts." delay={0.2} />
          <HelpCard icon={MessageCircle} title="Community Forum" desc="Discuss retail strategies and AI methodologies with other store owners." delay={0.3} />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default HelpCenterPage;
