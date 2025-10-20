import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Sparkles, ShieldCheck, Server } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const RoadmapItem = ({ icon: Icon, title, desc, delay }) => (
  <PremiumCard color="#8B5CF6" delay={delay} padding="2.5rem" noGlow={true}>
    <PremiumIconBox icon={Icon} color="#8B5CF6" size={28} style={{ width: 56, height: 56, borderRadius: '16px', marginBottom: '1.5rem' }} />
    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
    <p style={{ color: '#64748B', lineHeight: 1.7, fontSize: '1rem' }}>{desc}</p>
  </PremiumCard>
);

const FutureRoadmapPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.12em' }}>What's Next</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Future Roadmap
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Retail AI Suite is rapidly evolving. Here is a look at the enterprise features and AI capabilities we are building next.
          </p>
        </motion.div>
      </div>

      <div style={{ padding: '4rem 2rem 8rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <RoadmapItem 
            icon={Sparkles} 
            title="NLP Querying & Chatbot Assistant" 
            desc="We plan to integrate Large Language Models (LLMs) to allow users to ask questions about their data in plain English. For example, typing 'What were the top 5 selling products last week?' will automatically generate the correct SQL query and return a dynamic chart."
            delay={0.1}
          />
          <RoadmapItem 
            icon={ShieldCheck} 
            title="Enterprise Data Encryption (AES-256)" 
            desc="As we scale to handle sensitive retail data for larger clients, we will be implementing strict Data at Rest encryption (AES-256) on production databases, along with pursuing official SOC2 compliance certification."
            delay={0.2}
          />
          <RoadmapItem 
            icon={Server} 
            title="Isolated ML Inference via Kubernetes" 
            desc="Currently, our machine learning models run synchronously or via lightweight background tasks. In the future, we will deploy the architecture using Docker and Kubernetes to ensure each client's prediction models run in entirely isolated, ephemeral containers."
            delay={0.3}
          />
          <RoadmapItem 
            icon={Server} 
            title="REST API Integrations" 
            desc="We plan to expose a fully featured REST API, allowing Enterprise customers to push live transaction data directly from their Point of Sale (POS) systems or fetch predictive analytics programmatically."
            delay={0.4}
          />
        </div>
      </div>
    </MarketingLayout>
  );
};

export default FutureRoadmapPage;
