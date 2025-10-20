import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, ShieldAlert, UserPlus, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import LogoWhite from '../assets/Logo/retail-ai-suite-logo-white-horizontal.svg';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import API from '../api/index';
import AuthAnimatedPanel from '../components/auth/AuthAnimatedPanel';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Google Setup States
    const [isGoogleSetup, setIsGoogleSetup] = useState(false);
    const [setupEmail, setSetupEmail] = useState('');
    const [setupName, setSetupName] = useState('');
    const [setupPassword, setSetupPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await API.post('/users/login', { email, password });
            if (res.success) {
                login(res.user, res.token);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError(null);
        try {
            const res = await API.post('/users/google-login', { 
                token: credentialResponse.credential 
            });
            
            if (res.requires_password) {
                setIsGoogleSetup(true);
                setSetupEmail(res.email);
                setSetupName(res.name);
                return;
            }

            if (res.success) {
                login(res.user, res.token);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err || "Google authentication failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleSetupComplete = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await API.post('/users/google-setup', {
                email: setupEmail,
                password: setupPassword
            });
            if (res.success) {
                setIsGoogleSetup(false);
                alert(res.message || "Setup complete! Please verify your email.");
            }
        } catch (err) {
            setError(err || "Setup failed. Please try again.");
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
        transition: 'all 0.2s',
        fontFamily: "'Inter', sans-serif"
    };

    const inputWrapperStyle = {
        position: 'relative',
        marginBottom: '1.25rem'
    };

    const iconStyle = {
        position: 'absolute',
        left: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#94A3B8',
        pointerEvents: 'none'
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EFFF 30%, #F5F3FF 60%, var(--bg-secondary) 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Left side — Animated Branding */}
            <AuthAnimatedPanel 
                description="Transform your retail data into AI-powered insights. Forecast inventory, predict churn, and grow revenue."
                pills={['Sales Analytics', 'Churn Prediction', 'Inventory AI', 'Customer Segments']}
            />

            {/* Right side — Form */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{
                        width: '100%', maxWidth: '420px',
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        padding: '2.5rem',
                        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
                        border: '1px solid rgba(148, 163, 184, 0.15)'
                    }}
                >
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ 
                            fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)',
                            fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem'
                        }}>
                            {isGoogleSetup ? 'Complete Setup' : 'Welcome back'}
                        </h2>
                        <p style={{ color: '#64748B', fontSize: '0.85rem' }}>
                            {isGoogleSetup ? 'Set a password for your account' : 'Sign in to your retail intelligence workspace'}
                        </p>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '0.75rem 1rem', borderRadius: '10px',
                                background: 'var(--danger-bg)', border: '1px solid #FEE2E2',
                                color: '#DC2626', fontSize: '0.8rem', fontWeight: 500,
                                marginBottom: '1.5rem'
                            }}
                        >
                            <ShieldAlert size={16} /> {error}
                        </motion.div>
                    )}

                    <AnimatePresence mode='wait'>
                        {isGoogleSetup ? (
                            <motion.form 
                                key="setup"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleSetupComplete}
                            >
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Profile</label>
                                <div style={inputWrapperStyle}>
                                    <Mail size={16} style={iconStyle} />
                                    <input type="text" value={setupName} disabled style={{ ...inputStyle, opacity: 0.6 }} />
                                </div>

                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Create Password</label>
                                <div style={inputWrapperStyle}>
                                    <Lock size={16} style={iconStyle} />
                                    <input 
                                        type="password"
                                        placeholder="Enter a new password"
                                        value={setupPassword}
                                        onChange={(e) => setSetupPassword(e.target.value)}
                                        required autoFocus
                                        style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = '#2563EB'}
                                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                                    />
                                </div>
                                
                                <button type="submit" disabled={loading} style={{
                                    width: '100%', height: '48px', background: '#2563EB',
                                    border: 'none', borderRadius: '12px', color: 'white',
                                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    opacity: loading ? 0.6 : 1, transition: 'all 0.2s'
                                }}>
                                    {loading ? 'Saving...' : 'Set Password & Join'}
                                </button>
                                
                                <button type="button" onClick={() => setIsGoogleSetup(false)} style={{
                                    width: '100%', marginTop: '0.75rem', background: 'none', border: 'none',
                                    color: '#64748B', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                    padding: '0.5rem'
                                }}>
                                    ← Back to Sign In
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form 
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleLogin}
                            >
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
                                <div style={inputWrapperStyle}>
                                    <Mail size={16} style={iconStyle} />
                                    <input 
                                        type="email" 
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = '#2563EB'}
                                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                                    />
                                </div>

                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
                                <div style={inputWrapperStyle}>
                                    <Lock size={16} style={iconStyle} />
                                    <input 
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        style={{ ...inputStyle, paddingRight: '2.75rem' }}
                                        onFocus={e => e.target.style.borderColor = '#2563EB'}
                                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                                        position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0
                                    }}>
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748B', cursor: 'pointer' }}>
                                        <input type="checkbox" style={{ accentColor: '#2563EB' }} />
                                        <span>Remember me</span>
                                    </label>
                                    <Link to="/forgot" style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                                        Forgot password?
                                    </Link>
                                </div>

                                <button type="submit" disabled={loading} style={{
                                    width: '100%', height: '48px', background: '#2563EB',
                                    border: 'none', borderRadius: '12px', color: 'white',
                                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    opacity: loading ? 0.6 : 1, transition: 'all 0.2s',
                                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                                }}>
                                    {loading ? 'Signing in...' : 'Sign In'} 
                                    {!loading && <ArrowRight size={16} />}
                                </button>

                                <div style={{ 
                                    margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem',
                                    color: '#94A3B8', fontSize: '0.7rem', fontWeight: 600
                                }}>
                                    <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
                                    <span>or continue with</span>
                                    <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <GoogleLogin 
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => setError("Google Access Failed")}
                                        shape="pill"
                                        size="large"
                                    />
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748B' }}>
                        <span>Don't have an account? </span>
                        <Link to="/signup" style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none' }}>Sign up</Link>
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

export default LoginPage;
