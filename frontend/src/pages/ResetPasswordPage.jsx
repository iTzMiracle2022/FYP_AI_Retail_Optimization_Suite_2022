import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import API from '../api/index';

const ResetPasswordPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: "Passwords do not match." });
            return;
        }
        if (password.length < 6) {
            setStatus({ type: 'error', message: "Password must be at least 6 characters." });
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            const res = await API.post(`/users/reset-password/${token}`, { password });
            if (res.success) {
                setStatus({ type: 'success', message: res.message || "Password reset successfully!" });
                setTimeout(() => navigate('/login'), 2500);
            }
        } catch (err) {
            setStatus({ type: 'error', message: err || "Failed to reset password. The link might be expired." });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', height: '48px', background: 'var(--bg-secondary)',
        border: '1px solid var(--border)', borderRadius: '12px',
        padding: '0 2.75rem 0 2.75rem', fontSize: '0.9rem',
        color: 'var(--text-main)', outline: 'none', transition: 'border-color 0.2s'
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
                <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#7C3AED' }}>
                    <Lock size={24} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Set New Password</h2>
                <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '2rem' }}>Create a secure password for your account.</p>

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
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>New Password</label>
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                            <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" required autoFocus
                                value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle}
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
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Confirm Password</label>
                        <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                            <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" required
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                            />
                        </div>
                        <button type="submit" disabled={loading || !password || !confirmPassword} style={{
                            width: '100%', height: '48px', background: '#7C3AED',
                            border: 'none', borderRadius: '12px', color: 'white',
                            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            opacity: (loading || !password || !confirmPassword) ? 0.5 : 1,
                            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)'
                        }}>
                            {loading ? 'Saving...' : 'Update Password'} {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>
                ) : (
                    <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Redirecting to login...</p>
                )}

                <div style={{ marginTop: '2rem' }}>
                    <Link to="/login" style={{ color: '#7C3AED', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>Return to Sign In</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPasswordPage;
