import React from 'react';
import { motion } from 'framer-motion';
import { Book, Code, Terminal, Server } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const DocSection = ({ title, icon: Icon, children }) => (
  <div style={{ marginBottom: '2rem' }}>
    <PremiumCard color="#06B6D4" padding="2.5rem" noGlow={true}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
        <PremiumIconBox icon={Icon} color="#06B6D4" size={24} style={{ width: 48, height: 48, borderRadius: '12px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Manrope', sans-serif", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ color: '#475569', lineHeight: 1.8, fontSize: '1rem' }}>
        {children}
      </div>
    </PremiumCard>
  </div>
);

const DocumentationPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.12em' }}>User Guides</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Documentation
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Learn how to upload your datasets, configure your settings, and maximize the Retail AI Suite.
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem 8rem' }}>
        <DocSection title="Getting Started" icon={Book}>
          <p style={{ marginBottom: '1rem' }}>Welcome to the Retail AI Suite documentation. The easiest way to get started is by uploading your historical transaction data via our dashboard.</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li>Navigate to the <strong>Dataset Upload</strong> tab.</li>
            <li>Drag and drop your retail CSV file.</li>
            <li>Map your columns (InvoiceNo, StockCode, Quantity, etc.) to our standardized schema.</li>
          </ul>
        </DocSection>

        <DocSection title="Dashboard & Analytics" icon={Server}>
          <p style={{ marginBottom: '1rem' }}>Once your data is uploaded and processed, the <strong>Analytics Dashboard</strong> provides a unified view of your retail health. The dashboard updates automatically as new datasets are ingested.</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li>Track global metrics like Total Revenue and Prediction Accuracy.</li>
            <li>Navigate to specific modules (Churn, Inventory, Marketing) via the Sidebar.</li>
            <li>Export reports or toggle between dark/light mode in Settings.</li>
          </ul>
        </DocSection>

        <DocSection title="Predictive AI Models" icon={Code}>
          <p style={{ marginBottom: '1rem' }}>Our platform runs four primary predictive models asynchronously behind the scenes:</p>
          <ul style={{ paddingLeft: '1.5rem' }}>
            <li><strong>Churn Predictor:</strong> Calculates the probability of a customer lapsing in the next 30 days.</li>
            <li><strong>Sales Forecaster:</strong> Analyzes historical data to forecast future sales revenue and trends.</li>
            <li><strong>Inventory Optimizer:</strong> Detects anomalies in stock levels to prevent costly stockouts or overstocking.</li>
            <li><strong>Audience Segmentation:</strong> Automatically groups customers based on deep RFM (Recency, Frequency, Monetary) behavior.</li>
          </ul>
        </DocSection>
      </div>
    </MarketingLayout>
  );
};

export default DocumentationPage;
