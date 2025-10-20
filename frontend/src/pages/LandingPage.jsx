import React, { useRef, useState, useEffect, Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import {
  ArrowRight, BarChart2, Users, Box, TrendingUp,
  ChevronRight, Shield, Zap, LineChart, Database,
  Play, Check, Star, ArrowUpRight, Menu, X,
  Mail, Phone, MapPin, Cpu, Layers, Target,
  Github, Linkedin, Twitter, Globe, ExternalLink,
  Brain, Sparkles, Activity, PieChart, BarChart3, ShieldCheck
} from 'lucide-react';
import SmoothScroll from '../components/common/SmoothScroll';
import MarketingNavbar from '../components/common/MarketingNavbar';
import MarketingFooter from '../components/common/MarketingFooter';
import HeroAnimatedBackground from '../components/marketing/HeroAnimatedBackground';
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';

/* ═══════════════════════════════════════════
   DASHBOARD MOCKUP — Hero Visual
   ═══════════════════════════════════════════ */
const DashboardMockup = () => (
  <motion.div
    initial={{ opacity: 0, x: 60, y: 20, rotateY: -15, rotateX: 5 }}
    animate={{ opacity: 1, x: 0, y: 0, rotateY: -5, rotateX: 2 }}
    transition={{ duration: 1.2, type: 'spring', bounce: 0.2 }}
    style={{
      background: '#FAFBFF',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1rem',
      boxShadow: '0 30px 60px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1)',
      width: '100%',
      maxWidth: '750px',
      transformStyle: 'preserve-3d',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.1rem' }}>Retail Performance Overview</h2>
        <p style={{ fontSize: '0.6rem', color: '#64748B' }}>A live snapshot of your retail operations across every connected dataset.</p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ padding: '0.3rem 0.6rem', background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '0.5rem', fontWeight: 600, color: '#475569' }}>Refresh</div>
        <div style={{ padding: '0.3rem 0.6rem', background: '#3B82F6', borderRadius: '6px', fontSize: '0.5rem', fontWeight: 600, color: 'white' }}>Export</div>
      </div>
    </div>

    {/* 6 KPIs */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
      {[
        { t: 'Total Revenue', v: '$12.4M', s: '+24.8% vs last 30d', sc: '#10B981', c: '#10B981', bg: '#D1FAE5' },
        { t: 'Total Customers', v: '142,500', c: '#3B82F6', bg: '#DBEAFE' },
        { t: 'Active Datasets', v: '14', c: '#8B5CF6', bg: '#EDE9FE' },
        { t: 'At-Risk Customers', v: '214', c: '#EF4444', bg: '#FEE2E2' },
        { t: 'Low Stock Alerts', v: '12', c: '#F59E0B', bg: '#FEF3C7' },
        { t: 'Reports Generated', v: '1,420', c: '#3B82F6', bg: '#DBEAFE' }
      ].map((k, i) => (
        <div key={i} style={{ background: 'white', padding: '0.6rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <p style={{ fontSize: '0.45rem', color: '#64748B', fontWeight: 600 }}>{k.t}</p>
            <div style={{ width: 12, height: 12, background: k.bg, borderRadius: '4px' }} />
          </div>
          <p style={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 800 }}>{k.v}</p>
          {k.s && <p style={{ fontSize: '0.4rem', color: k.sc, marginTop: '0.2rem', fontWeight: 700 }}>{k.s}</p>}
        </div>
      ))}
    </div>

    {/* Middle Row: Charts */}
    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <div style={{ background: 'white', padding: '0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.6rem', color: '#0F172A', fontWeight: 800 }}>Revenue Trend</p>
            <p style={{ fontSize: '0.45rem', color: '#64748B' }}>Performance over time</p>
          </div>
          <div style={{ fontSize: '0.45rem', padding: '2px 6px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>Last 14 days</div>
        </div>
        <div style={{ height: '80px', width: '100%', marginTop: '0.5rem' }}>
          <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id="chartGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,70 L40,65 L80,55 L120,40 L160,45 L200,42 L240,35 L280,30 L320,32 L360,20 L400,10 L400,80 L0,80 Z" fill="url(#chartGrad2)" />
            <path d="M0,70 L40,65 L80,55 L120,40 L160,45 L200,42 L240,35 L280,30 L320,32 L360,20 L400,10" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ background: 'white', padding: '0.8rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.6rem', color: '#0F172A', fontWeight: 800 }}>Module Activity</p>
            <p style={{ fontSize: '0.45rem', color: '#64748B' }}>Usage by category</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '80px', marginTop: '0.5rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
          <div style={{ width: '15%', height: '90%', background: '#3B82F6', borderRadius: '2px 2px 0 0' }} />
          <div style={{ width: '15%', height: '65%', background: '#3B82F6', borderRadius: '2px 2px 0 0' }} />
          <div style={{ width: '15%', height: '40%', background: '#3B82F6', borderRadius: '2px 2px 0 0' }} />
          <div style={{ width: '15%', height: '30%', background: '#3B82F6', borderRadius: '2px 2px 0 0' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '4px' }}>
          <span style={{ fontSize: '0.35rem', color: '#64748B' }}>Sales</span>
          <span style={{ fontSize: '0.35rem', color: '#64748B' }}>Churn</span>
          <span style={{ fontSize: '0.35rem', color: '#64748B' }}>Inv.</span>
          <span style={{ fontSize: '0.35rem', color: '#64748B' }}>Mkt.</span>
        </div>
      </div>
    </div>

    {/* Bottom Row */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
      {[
        { t: 'Sales Trends', d: 'Revenue, top products.' },
        { t: 'Customer Churn', d: 'Identify at-risk.' },
        { t: 'Inventory Forecast', d: 'Demand and low-stock.' },
        { t: 'Marketing Segments', d: 'RFM + sentiment.' }
      ].map((b, i) => (
        <div key={i} style={{ background: 'white', padding: '0.6rem', borderRadius: '8px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.55rem', color: '#0F172A', fontWeight: 800 }}>{b.t}</p>
            <p style={{ fontSize: '0.4rem', color: '#64748B', marginTop: '2px' }}>{b.d}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.35rem', color: '#94A3B8' }}>Last run - 2h ago</span>
            <span style={{ fontSize: '0.4rem', color: '#3B82F6', fontWeight: 600 }}>Open →</span>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

/* ─── Animated Counter ─── */
const AnimatedCounter = ({ end, suffix = '', prefix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const startTime = performance.now();
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
};

/* ─── Section Fade In ─── */
const FadeInSection = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    viewport={{ once: true, margin: "-100px" }}
  >
    {children}
  </motion.div>
);

/* ─── Old Feature Card (Removed) ─── */

/* ─── How It Works Step ─── */
const Step = ({ num, title, desc, delay }) => (
  <PremiumCard color="#7C3AED" delay={delay} padding="2rem" className="step-card" style={{ flex: 1, minWidth: '200px' }}>
    <div style={{
      width: 56, height: 56, borderRadius: '16px', margin: '0 auto 1rem',
      background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.25rem', fontWeight: 900, fontFamily: "'Manrope', sans-serif",
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)'
    }}>{num}</div>
    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', textAlign: 'center' }}>{title}</h4>
    <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6, maxWidth: '250px', margin: '0 auto', textAlign: 'center' }}>{desc}</p>
  </PremiumCard>
);

/* ═══════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();


  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  return (
    <SmoothScroll>
      <div style={{ background: '#FAFBFF', minHeight: '100vh', overflow: 'hidden' }}>

        {/* ════════════ NAVBAR ════════════ */}
        <MarketingNavbar />

        {/* ════════════ HERO ════════════ */}
        <HeroAnimatedBackground>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>

            {/* Text Content */}
            <div style={{ flex: '1 1 50%', maxWidth: '620px' }}>
              <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="hero-parallax-badge">
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
                  background: 'var(--bg-card)', border: '1px solid rgba(37, 99, 235, 0.15)',
                  borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, color: '#2563EB',
                  marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)'
                }}>
                  <Sparkles size={14} /> AI-Powered Retail Analytics Platform
                </div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
                style={{
                  fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 900,
                  color: 'var(--text-main)', lineHeight: 1.15, letterSpacing: '-0.03em',
                  fontFamily: "'Manrope', sans-serif", marginBottom: '1.5rem'
                }}>
                Transform retail data into{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>intelligent decisions</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
                style={{ fontSize: '1.1rem', color: '#64748B', lineHeight: 1.7, marginBottom: '2rem', maxWidth: '520px' }}>
                Forecast inventory, predict customer churn, analyze sales trends, and segment audiences — all from one AI-powered dashboard.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.5, duration: 0.5 }}
                style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/signup')} className="hero-cta-btn">
                  Start Free Trial <ArrowRight size={16} className="hero-cta-arrow" />
                </button>
              </motion.div>

              {/* Trust badges */}
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
                style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
                {[
                  { icon: Shield, text: 'Enterprise Security' },
                  { icon: Zap, text: 'Real-time Analytics' },
                  { icon: Brain, text: 'AI-Powered' },
                ].map(({ icon: I, text }) => (
                  <div key={text} className="hero-trust-badge">
                    <I size={14} color="#2563EB" /> {text}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Dashboard Mockup on the right */}
            <div className="hero-mockup-wrapper" style={{ flex: '1 1 50%', display: 'flex', justifyContent: 'flex-end', perspective: '1000px' }}>
              <div className="hero-parallax-dashboard">
                <DashboardMockup />
              </div>
            </div>

          </div>
        </HeroAnimatedBackground>

        {/* ════════════ STATS ════════════ */}
        <section style={{ padding: '4rem 2rem', background: 'var(--bg-card)', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{
            maxWidth: '1100px', margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem',
            textAlign: 'center'
          }}>
            {[
              { value: 98, suffix: '%', label: 'Prediction Accuracy' },
              { value: 4, suffix: '', label: 'AI Modules' },
              { value: 50, suffix: 'K+', label: 'Datasets Processed' },
              { value: 500, suffix: '+', label: 'Retail Partners' },
            ].map(({ value, suffix, label }, i) => (
              <FadeInSection key={label} delay={i * 0.1}>
                <p style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", lineHeight: 1 }}>
                  <AnimatedCounter end={value} suffix={suffix} />
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500, marginTop: '6px' }}>{label}</p>
              </FadeInSection>
            ))}
          </div>
        </section>

        {/* ════════════ THE PROBLEM ════════════ */}
        <section id="problem" style={{ padding: '6rem 2rem', background: '#FFFFFF' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <FadeInSection>
              <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.12em' }}>The Problem</span>
                <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", margin: '0.5rem auto 0', letterSpacing: '-0.02em', maxWidth: '600px', lineHeight: 1.2 }}>
                  Retail data is everywhere but insights aren't
                </h2>
                <p style={{ color: '#64748B', maxWidth: '600px', margin: '1rem auto 0', lineHeight: 1.7, fontSize: '1.05rem' }}>
                  Most retailers sit on years of transaction data but lack the tools to act on it.
                </p>
              </div>
            </FadeInSection>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              {[
                { title: 'Losing customers without knowing why', desc: "Churn happens silently — by the time you notice, they're gone." },
                { title: 'Stockouts and overstocking', desc: 'Wrong inventory at the wrong time costs revenue and storage.' },
                { title: 'Generic marketing campaigns', desc: 'One-size-fits-all messaging misses the people who matter most.' },
                { title: 'Poor sales visibility', desc: 'Spreadsheets hide trends, top products, and category shifts.' }
              ].map((problem, i) => (
                <PremiumCard key={i} color="#EF4444" delay={i * 0.1} padding="1.75rem">
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '0.9rem' }}>!</span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', lineHeight: 1.4, fontFamily: "'Manrope', sans-serif" }}>{problem.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6 }}>{problem.desc}</p>
                </PremiumCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ FEATURES ════════════ */}
        <section id="features" style={{ padding: '6rem 2rem', background: '#FAFBFF' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} viewport={{ once: true }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Features</span>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
                  Everything you need to optimize retail
                </h2>
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.10 }} viewport={{ once: true }} style={{ color: '#64748B', maxWidth: '500px', margin: '0.75rem auto 0', lineHeight: 1.7 }}>
                Four AI-powered modules working together to give you a complete picture of your retail operations.
              </motion.p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {[
                { icon: LineChart, title: 'Sales Trend Analysis', desc: 'Discover revenue patterns, top products, and seasonal trends with interactive time-series visualizations.', color: '#2563EB' },
                { icon: Users, title: 'Customer Churn Prediction', desc: 'Identify at-risk customers before they leave using machine learning behavioral analysis.', color: '#7C3AED' },
                { icon: Box, title: 'Inventory Forecasting', desc: 'AI-powered demand prediction with automated reorder alerts and stock optimization.', color: '#D97706' },
                { icon: TrendingUp, title: 'Marketing Segmentation', desc: 'Cluster customers by spending, frequency, and sentiment for targeted campaigns.', color: '#06B6D4' }
              ].map(({ icon: I, title, desc, color }, i) => (
                <PremiumCard key={title} color={color} delay={0.15 + i * 0.1}>
                  <PremiumIconBox icon={I} color={color} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.7 }}>{desc}</p>
                </PremiumCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ SOLUTIONS ════════════ */}
        <section id="solutions" style={{ padding: '6rem 2rem', background: 'var(--bg-card)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <FadeInSection>
              <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Solutions</span>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginTop: '0.5rem' }}>
                  Built for every retail challenge
                </h2>
              </div>
            </FadeInSection>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {[
                { icon: Target, title: 'Predict & Prevent Churn', desc: 'Our ML models track subtle shifts in purchasing behavior to flag at-risk accounts weeks before they leave, allowing you to deploy automated win-back campaigns.', color: '#DC2626' },
                { icon: Activity, title: 'Automated Demand Forecasting', desc: 'Stop guessing inventory. The platform ingests historical data and seasonal trends to calculate exact restock dates and optimal order quantities.', color: '#D97706' },
                { icon: Users, title: 'Hyper-Personalized Segmentation', desc: 'Automatically group your customer base using deep RFM (Recency, Frequency, Monetary) metrics, ensuring your marketing dollars only target high-conversion cohorts.', color: '#06B6D4' },
                { icon: BarChart3, title: 'Crystal-Clear Intelligence', desc: 'Abandon the messy spreadsheets. Instantly visualize revenue velocity, category performance, and profit margins through dynamic, real-time dashboards.', color: '#10B981' },
              ].map(({ icon: I, title, desc, color }, i) => (
                <PremiumCard key={title} color={color} delay={i * 0.15} padding="2.5rem">
                  <PremiumIconBox icon={I} color={color} size={28} style={{ width: 56, height: 56, borderRadius: '16px' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
                  <p style={{ color: '#64748B', lineHeight: 1.7, fontSize: '0.9rem' }}>{desc}</p>
                </PremiumCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ HOW IT WORKS ════════════ */}
        <section id="how-it-works" style={{ padding: '6rem 2rem', background: '#FAFBFF' }}>
          <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
            <FadeInSection>
              <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.12em' }}>How it works</span>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginTop: '0.5rem' }}>
                  Three steps to smarter retail
                </h2>
              </div>
            </FadeInSection>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
              <Step num="1" title="Upload Your Data" desc="Drop a CSV or connect your database. We handle cleaning and preprocessing automatically." delay={0.1} />
              <Step num="2" title="AI Analyzes Everything" desc="AI models analyze sales, churn, inventory, and marketing data together to generate smart insights." delay={0.2} />
              <Step num="3" title="Get Actionable Insights" desc="View results in interactive dashboards, export reports, and take action on AI recommendations." delay={0.3} />
            </div>
          </div>
        </section>

        {/* ════════════ PRICING ════════════ */}
        <section id="pricing" style={{ padding: '6rem 2rem', background: 'var(--bg-card)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <FadeInSection>
              <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pricing</span>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginTop: '0.5rem' }}>
                  Simple, transparent pricing
                </h2>
              </div>
            </FadeInSection>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {[
                { name: 'Starter', price: 'Free', desc: 'For single-store retailers getting started', features: ['Basic analytics dashboard', 'Sales trend overview', 'CSV dataset upload', 'Standard PDF/CSV exports', '1 user seat'], cta: 'Get Started Free', primary: false, color: '#3B82F6' },
                { name: 'Shop', price: '$9/mo', desc: 'For small shops that want smarter daily decisions', features: ['Sales trends analysis', 'Customer churn prediction', 'Inventory forecasting', 'Marketing segmentation', '2 user seats', 'Priority email support'], cta: 'Start Free Trial', primary: true, color: '#2563EB' },
                { name: 'Growth', price: '$29/mo', desc: 'For growing retailers with multiple product categories', features: ['All AI modules unlocked', 'Advanced dashboard insights', 'Dataset history', 'Report exports', 'Up to 5 user seats', 'Team collaboration'], cta: 'Choose Growth', primary: false, color: '#7C3AED' },
              ].map(({ name, price, desc, features, cta, primary, color }, i) => (
                <PremiumCard key={name} color={color} delay={i * 0.1} padding="2.5rem" isPrimary={primary}>
                  {primary && <span style={{ position: 'absolute', top: '-12px', right: '1.5rem', background: '#FBBF24', color: '#0F172A', fontSize: '0.65rem', fontWeight: 800, padding: '4px 12px', borderRadius: '6px' }}>MOST POPULAR</span>}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif", color: primary ? 'white' : '#0F172A' }}>{name}</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1.25rem', color: primary ? 'rgba(255,255,255,0.85)' : '#64748B' }}>{desc}</p>
                  <p style={{ fontSize: '2rem', fontWeight: 900, fontFamily: "'Manrope', sans-serif", marginBottom: '1.5rem', color: primary ? 'white' : '#0F172A' }}>{price}</p>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
                    {features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: primary ? 'white' : '#334155' }}>
                        <Check size={14} style={{ opacity: 0.8 }} /> <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => navigate('/signup')} style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px', fontWeight: 700,
                    fontSize: '0.9rem', cursor: 'pointer', border: 'none',
                    background: primary ? 'white' : '#2563EB',
                    color: primary ? '#2563EB' : 'white',
                    boxShadow: primary ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.25)'
                  }}>{cta}</button>
                </PremiumCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ CTA ════════════ */}
        <HeroAnimatedBackground style={{ minHeight: 'auto', paddingTop: '100px', paddingBottom: '100px', paddingLeft: '24px', paddingRight: '24px' }}>
          <div style={{ maxWidth: '820px', margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center', width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              viewport={{ once: true }}
              style={{
                background: 'rgba(255, 255, 255, 0.48)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                borderRadius: '28px',
                padding: '48px 56px',
                boxShadow: '0 18px 55px rgba(15, 23, 42, 0.06)',
                margin: '0 auto'
              }}
            >
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginBottom: '16px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Ready to transform your retail data?
              </h2>
              <p style={{ color: '#64748B', fontSize: 'clamp(15px, 2vw, 17px)', lineHeight: 1.6, marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
                Join retailers who use AI analytics to increase revenue and reduce churn.
              </p>

              <motion.button
                onClick={() => navigate('/signup')}
                whileHover={{ y: -3, boxShadow: '0 16px 36px rgba(37, 99, 235, 0.35)' }}
                className="cta-button"
                style={{
                  background: '#2563EB', color: 'white', border: 'none',
                  padding: '16px 34px', borderRadius: '14px',
                  fontSize: '16px', fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 12px 28px rgba(37, 99, 235, 0.25)',
                  transition: 'background 0.22s ease-out'
                }}
              >
                Get Started Free <ArrowRight size={18} className="cta-arrow" />
              </motion.button>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginTop: '36px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13.5px', fontWeight: 600 }}>
                  <ShieldCheck size={16} color="#2563EB" /> No credit card required
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13.5px', fontWeight: 600 }}>
                  <Zap size={16} color="#2563EB" /> Start in minutes
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13.5px', fontWeight: 600 }}>
                  <Check size={16} color="#2563EB" /> Secure data handling
                </span>
              </div>
            </motion.div>
          </div>
        </HeroAnimatedBackground>

        {/* ════════════ FOOTER ════════════ */}
        <MarketingFooter />

        {/* ─── Responsive CSS ─── */}
        <style>{`
          @media (max-width: 768px) {
            .landing-nav-links { display: none !important; }
            .landing-nav-btns { display: none !important; }
            .landing-mobile-btn { display: flex !important; }
            section[style*="padding: 90px 24px"] {
              padding: 60px 16px !important;
            }
            section[style*="padding: 90px 24px"] > div > div {
              padding: 36px 24px !important;
            }
          }
          @media (max-width: 480px) {
            section[style*="padding: 90px 24px"] > div > div {
              padding: 28px 20px !important;
            }
          }
          
          .cta-button .cta-arrow {
            transition: transform 0.22s ease-out;
          }
          .cta-button:hover .cta-arrow {
            transform: translateX(4px);
          }
        `}</style>
      </div>
    </SmoothScroll>
  );
};

export default LandingPage;
