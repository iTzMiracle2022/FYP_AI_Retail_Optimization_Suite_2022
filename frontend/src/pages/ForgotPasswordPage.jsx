import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import API from '../api/index';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            const res = await API.post('/users/forgot-password', { email });
            if (res.success) {
                setStatus({ type: 'success', message: res.message || "Reset link sent! Please check your email." });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err || "Failed to send reset link." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EFFF 30%, #F5F3FF 60%, var(--bg-secondary) 100%)',
            padding: '2rem'
        }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{
                    width: '100%', maxWidth: '440px', background: 'var(--bg-card)', borderRadius: '24px',
                    padding: '2.5rem', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
                    border: '1px solid rgba(148, 163, 184, 0.15)', textAlign: 'center'
                }}>
                
                <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#2563EB' }}>
                    <Send size={24} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Reset Password</h2>
                <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '2rem' }}>Enter your email to receive a password reset link.</p>

                {status && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '0.75rem 1rem', borderRadius: '10px',
                            background: status.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                            border: `1px solid ${status.type === 'success' ? '#BBF7D0' : '#FEE2E2'}`,
                            color: status.type === 'success' ? '#16A34A' : '#DC2626',
                            fontSize: '0.8rem', fontWeight: 500, marginBottom: '1.5rem', textAlign: 'left'
                        }}>
                        {status.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                        <span>{status.message}</span>
                    </motion.div>
                )}

                {!status || status.type === 'error' ? (
                    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                            <input type="email" placeholder="you@company.com" required autoFocus
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%', height: '48px', background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)', borderRadius: '12px',
                                    padding: '0 1rem 0 2.75rem', fontSize: '0.9rem',
                                    color: 'var(--text-main)', outline: 'none', transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#2563EB'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                        </div>
                        <button type="submit" disabled={loading || !email} style={{
                            width: '100%', height: '48px', background: '#2563EB',
                            border: 'none', borderRadius: '12px', color: 'white',
                            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                            opacity: (loading || !email) ? 0.5 : 1, transition: 'all 0.2s',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                        }}>
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                ) : (
                    <p style={{ color: '#64748B', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        If an account exists for <strong>{email}</strong>, you'll receive an email with reset instructions.
                    </p>
                )}

                <div style={{ marginTop: '2rem' }}>
                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#2563EB', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
                        <ArrowLeft size={16} /> Back to Sign In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPasswordPage;
