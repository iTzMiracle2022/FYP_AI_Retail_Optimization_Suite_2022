import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const VerifyEmail = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying');

    useEffect(() => {
        const verify = async () => {
            try {
                const res = await axios.get(`/api/users/verify/${token}`);
                if (res.data.success) {
                    setStatus('success');
                    setTimeout(() => navigate('/login'), 4000);
                }
            } catch (err) {
                setStatus('error');
            }
        };
        if (token) verify();
    }, [token, navigate]);

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #F0F4FF 0%, #E8EFFF 30%, #F5F3FF 60%, var(--bg-secondary) 100%)',
            padding: '1rem'
        }}>
            <div style={{
                maxWidth: '450px', width: '100%', padding: '3rem', textAlign: 'center',
                background: 'var(--bg-card)', borderRadius: '24px',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)'
            }}>
                {status === 'verifying' && (
                    <>
                        <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Loader2 size={24} color="#2563EB" className="spin-slow" />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Verifying your email</h2>
                        <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Please wait while we confirm your account...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <CheckCircle size={24} color="#16A34A" />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Email Verified!</h2>
                        <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '2rem' }}>
                            Your account is active. Redirecting to login...
                        </p>
                        <Link to="/login" style={{
                            display: 'inline-flex', padding: '0.7rem 1.75rem',
                            background: '#2563EB', borderRadius: '12px', color: 'white',
                            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                        }}>
                            Go to Sign In
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <AlertCircle size={24} color="#DC2626" />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Verification Failed</h2>
                        <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '2rem' }}>
                            This link is invalid or expired. Please sign up again.
                        </p>
                        <Link to="/signup" style={{
                            display: 'inline-flex', padding: '0.7rem 1.75rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px',
                            color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none'
                        }}>
                            Back to Sign Up
                        </Link>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin-slow { animation: spin 1.5s linear infinite; }
            `}</style>
        </div>
    );
};

export default VerifyEmail;
