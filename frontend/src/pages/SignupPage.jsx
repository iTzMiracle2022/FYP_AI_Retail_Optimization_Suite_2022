import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import API from '../api/index';
import AuthAnimatedPanel from '../components/auth/AuthAnimatedPanel';

const SignupPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            const res = await API.post('/users/signup', formData);
            if (res.success) {
                setStatus({ 
                    type: 'success',
                    message: "Account created! You can now login."
                });
                setTimeout(() => navigate('/login'), 2000);
            }
        } catch (err) {
            setStatus({ type: 'error', message: err });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', height: '48px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '0 1rem 0 2.75rem',
        fontSize: '0.9rem',
        color: 'var(--text-main)',
        outline: 'none',
        transition: 'border-color 0.2s',
        fontFamily: "'Inter', sans-serif"
    };

    const iconStyle = {
        position: 'absolute', left: '1rem', top: '50%',
        transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none'
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EFFF 30%, #F5F3FF 60%, var(--bg-secondary) 100%)',
            overflow: 'hidden'
        }}>
            {/* Left side — Animated Branding */}
            <AuthAnimatedPanel 
                title="Start Your Journey"
                description="Join retailers who use AI-powered analytics to make smarter decisions every day."
            />

            {/* Right Form */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                    
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>
                        Create your account
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '2rem' }}>
                        Start transforming retail data into AI-powered insights.
                    </p>

                    {status && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '0.75rem 1rem', borderRadius: '10px',
                                background: status.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                border: `1px solid ${status.type === 'success' ? '#BBF7D0' : '#FEE2E2'}`,
                                color: status.type === 'success' ? '#16A34A' : '#DC2626',
                                fontSize: '0.8rem', fontWeight: 500, marginBottom: '1.5rem'
                            }}>
                            {status.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                            <span>{status.message}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSignup}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name</label>
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <User size={16} style={iconStyle} />
                            <input type="text" placeholder="Your full name" required
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                        </div>

                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <Mail size={16} style={iconStyle} />
                            <input type="email" placeholder="you@company.com" required
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                        </div>

                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
                        <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
                            <Lock size={16} style={iconStyle} />
                            <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" required
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0
                            }}>
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <button type="submit" disabled={loading} style={{
                            width: '100%', height: '48px', background: '#7C3AED',
                            border: 'none', borderRadius: '12px', color: 'white',
                            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            opacity: loading ? 0.6 : 1, transition: 'all 0.2s',
                            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)'
                        }}>
                            {loading ? 'Creating account...' : 'Create Account'}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748B' }}>
                        <span>Already have an account? </span>
                        <Link to="/login" style={{ color: '#7C3AED', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                    </div>
                </motion.div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .auth-left-panel { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default SignupPage;
