import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LogoWhite from '../../assets/Logo/retail-ai-suite-logo-white-horizontal.svg';
import './AuthAnimatedPanel.css';

const AuthAnimatedPanel = ({ title, description, pills = [] }) => {
    const panelRef = useRef(null);
    const pCanvasRef = useRef(null);
    const nCanvasRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);

    // Canvas animation logic
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const pCanvas = pCanvasRef.current;
        const nCanvas = nCanvasRef.current;
        const panel = panelRef.current;
        if (!pCanvas || !nCanvas || !panel) return;
        
        const pCtx = pCanvas.getContext('2d');
        const nCtx = nCanvas.getContext('2d');
        
        // Use panel dimensions to avoid 0x0 bug when rendering absolute children
        let width = panel.clientWidth || window.innerWidth / 2;
        let height = panel.clientHeight || window.innerHeight;
        pCanvas.width = width;
        pCanvas.height = height;
        nCanvas.width = width;
        nCanvas.height = height;
        
        const resizeCanvas = () => {
            if (!panel) return;
            width = panel.clientWidth || window.innerWidth / 2;
            height = panel.clientHeight || window.innerHeight;
            pCanvas.width = width;
            pCanvas.height = height;
            nCanvas.width = width;
            nCanvas.height = height;
        };
        window.addEventListener('resize', resizeCanvas);

        const isMob = window.innerWidth < 768;
        const numParticles = isMob ? 60 : 140;
        const particles = [];
        const colors = ['#ffffff', '#06b6d4', '#7dd3fc', '#c4b5fd'];

        for (let i = 0; i < numParticles; i++) {
            const isLine = Math.random() > 0.85; 
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 2, // 2px to 4px
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: Math.random() * 0.3 + 0.25, // 0.25 to 0.55
                isLine: isLine,
                angle: isLine ? Math.random() * Math.PI * 2 : 0,
                length: isLine ? Math.random() * 12 + 6 : 0
            });
        }

        let animationFrameId;
        let mouseX = width / 2;
        let mouseY = height / 2;

        const handleCanvasMouseMove = (e) => {
            const rect = panel.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        };
        panel.addEventListener('mousemove', handleCanvasMouseMove);

        const draw = () => {
            pCtx.clearRect(0, 0, width, height);
            nCtx.clearRect(0, 0, width, height);
            
            // Update and draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                // Bounce off edges smoothly
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                // Mouse interaction - gentle push and glow
                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    p.x -= dx * 0.01;
                    p.y -= dy * 0.01;
                    p.currentOpacity = Math.min(p.opacity * 1.5, 0.8);
                } else {
                    p.currentOpacity = p.opacity;
                }

                // Draw Particle
                pCtx.beginPath();
                if (p.isLine) {
                    pCtx.moveTo(p.x, p.y);
                    pCtx.lineTo(p.x + Math.cos(p.angle) * p.length, p.y + Math.sin(p.angle) * p.length);
                    pCtx.lineWidth = p.size / 2;
                    pCtx.strokeStyle = p.color;
                    pCtx.globalAlpha = p.currentOpacity;
                    pCtx.stroke();
                } else {
                    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    pCtx.fillStyle = p.color;
                    pCtx.globalAlpha = p.currentOpacity;
                    pCtx.fill();
                }

                // Draw Connections
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx2 = p.x - p2.x;
                    const dy2 = p.y - p2.y;
                    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    
                    if (dist2 < 85) {
                        nCtx.beginPath();
                        nCtx.moveTo(p.x, p.y);
                        nCtx.lineTo(p2.x, p2.y);
                        nCtx.lineWidth = 0.6;
                        nCtx.strokeStyle = '#ffffff';
                        // Max opacity 0.16
                        nCtx.globalAlpha = (85 - dist2) / 85 * 0.16; 
                        nCtx.stroke();
                    }
                }
            }
            animationFrameId = requestAnimationFrame(draw);
        };
        
        draw();

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('resize', resizeCanvas);
            panel.removeEventListener('mousemove', handleCanvasMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    const handleMouseMove = (e) => {
        if (isMobile || !panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        
        panelRef.current.style.setProperty('--mouse-x', x);
        panelRef.current.style.setProperty('--mouse-y', y);
    };

    const handleMouseLeave = () => {
        if (!panelRef.current) return;
        panelRef.current.style.setProperty('--mouse-x', 0);
        panelRef.current.style.setProperty('--mouse-y', 0);
    };

    return (
        <div 
            ref={panelRef}
            className="auth-animated-panel"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ '--mouse-x': 0, '--mouse-y': 0 }}
        >
            {/* Animated Background Blobs Layer */}
            <div className="auth-blob-layer">
                <div className="auth-blob blob-1" />
                <div className="auth-blob blob-2" />
                <div className="auth-blob blob-3" />
                <div className="auth-blob blob-4" />
            </div>

            {/* Network Lines Layer */}
            <div className="auth-network-layer">
                <canvas ref={nCanvasRef} className="auth-canvas-overlay" />
            </div>

            {/* Particles Layer */}
            <div className="auth-particle-layer">
                <canvas ref={pCanvasRef} className="auth-canvas-overlay" />
            </div>

            {/* Back Button */}
            <Link to="/" className="auth-back-btn">
                <ArrowLeft size={16} /> Back to Home
            </Link>

            {/* Main Content Layer */}
            <motion.div 
                className="auth-content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
            >
                {/* Logo with Orbit */}
                <div className="logo-group">
                    <div className="logo-orbit-ring ring-1">
                        <div className="orbit-dot dot-1"></div>
                    </div>
                    <div className="logo-orbit-ring ring-2">
                        <div className="orbit-dot dot-2"></div>
                    </div>
                    <div className="logo-orbit-ring ring-3">
                        <div className="orbit-dot dot-3"></div>
                    </div>
                    <img src={LogoWhite} alt="Retail AI Suite" className="auth-logo" />
                </div>

                {title && <h1 className="auth-title">{title}</h1>}
                {description && <p className="auth-desc">{description}</p>}

                {/* Module Pills */}
                {pills && pills.length > 0 && (
                    <div className="auth-pills-wrapper">
                        <div className="auth-pills-row w-full">
                            {pills.map((pill, i) => (
                                <motion.span 
                                    key={pill} 
                                    className="auth-pill"
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + (i * 0.1), duration: 0.4 }}
                                    whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.2)', transition: { duration: 0.2 } }}
                                >
                                    {pill}
                                </motion.span>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AuthAnimatedPanel;
