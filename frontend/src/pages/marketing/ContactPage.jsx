import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin } from 'lucide-react';
import MarketingLayout from '../../components/common/MarketingLayout';
import { PremiumCard, PremiumIconBox } from '../../components/marketing/PremiumCard';

const ContactPage = () => {
  return (
    <MarketingLayout>
      <div style={{ padding: '2rem 2rem 1.5rem', textAlign: 'center', background: '#FFFFFF' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Support & Sales</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginTop: '1rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Get in Touch
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#64748B', marginTop: '1.5rem', lineHeight: 1.6 }}>
            Have a question about our enterprise plans or need help setting up your first dataset? We're here to help.
          </p>
        </motion.div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem 8rem', display: 'flex', flexWrap: 'wrap', gap: '4rem' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '2rem', fontFamily: "'Manrope', sans-serif" }}>Contact Information</h2>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <PremiumCard color="#2563EB" delay={0.1} padding="1.5rem" noGlow={true}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <PremiumIconBox icon={Mail} color="#2563EB" size={20} style={{ width: 40, height: 40, borderRadius: '10px' }} />
                <div>
                  <p style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>Email</p>
                  <p style={{ color: '#64748B', fontSize: '0.9rem' }}>hello@retailai.com</p>
                </div>
              </div>
            </PremiumCard>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <PremiumCard color="#2563EB" delay={0.2} padding="1.5rem" noGlow={true}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <PremiumIconBox icon={Phone} color="#2563EB" size={20} style={{ width: 40, height: 40, borderRadius: '10px' }} />
                <div>
                  <p style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>Phone</p>
                  <p style={{ color: '#64748B', fontSize: '0.9rem' }}>+1 (555) 123-4567</p>
                </div>
              </div>
            </PremiumCard>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <PremiumCard color="#2563EB" delay={0.3} padding="1.5rem" noGlow={true}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <PremiumIconBox icon={MapPin} color="#2563EB" size={20} style={{ width: 40, height: 40, borderRadius: '10px' }} />
                <div>
                  <p style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>Office</p>
                  <p style={{ color: '#64748B', fontSize: '0.9rem' }}>123 AI Boulevard<br/>San Francisco, CA 94105</p>
                </div>
              </div>
            </PremiumCard>
          </div>
        </div>

        <PremiumCard color="#64748B" padding="2.5rem" style={{ flex: '2 1 400px' }} noGlow={true}>
          <form onSubmit={e => e.preventDefault()}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>First Name</label>
                <input type="text" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Last Name</label>
                <input type="text" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }} />
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Email Address</label>
              <input type="email" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Message</label>
              <textarea rows="4" style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none', resize: 'vertical' }}></textarea>
            </div>
            <button style={{ width: '100%', padding: '1rem', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
              Send Message
            </button>
          </form>
        </PremiumCard>
      </div>
    </MarketingLayout>
  );
};

export default ContactPage;
