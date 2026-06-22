import React, { useRef, useState, useEffect } from 'react';
import './HeroAnimatedBackground.css';

const HeroAnimatedBackground = ({ children, className = "", style = {} }) => {
    const sectionRef = useRef(null);
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: null, y: null });
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        
        const updateSize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        updateSize();
        window.addEventListener('resize', updateSize);

        let animationFrameId;
        const colors = ['#2563EB', '#06B6D4', '#7C3AED', '#93C5FD'];
        const particles = [];
        const count = window.innerWidth > 768 ? 85 : 40;

        for (let i = 0; i < count; i++) {
            // Favor right side placement
            const isRightSide = Math.random() > 0.3;
            const startX = isRightSide 
                ? canvas.width * 0.5 + Math.random() * (canvas.width * 0.5)
                : Math.random() * canvas.width;

            particles.push({
                x: startX,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: Math.random() * 6 + 2, // 2 to 8px radius (4 to 16px diameter)
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.2 + 0.45, // 0.45 to 0.65 opacity
            });
        }

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(p => {
                // Apply friction
                p.vx *= 0.985;
                p.vy *= 0.985;

                // Mouse interaction
                if (mouseRef.current.x !== null) {
                    const dx = mouseRef.current.x - p.x;
                    const dy = mouseRef.current.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 250) {
                        const force = (250 - dist) / 250;
                        // Follow cursor lightly
                        p.vx += (dx / dist) * force * 0.05;
                        p.vy += (dy / dist) * force * 0.05;
                    } else {
                        // Drift back to random walk if far from mouse
                        p.vx += (Math.random() - 0.5) * 0.03;
                        p.vy += (Math.random() - 0.5) * 0.03;
                    }
                } else {
                    // Drift back to random walk if no mouse
                    p.vx += (Math.random() - 0.5) * 0.03;
                    p.vy += (Math.random() - 0.5) * 0.03;
                }

                // Max velocity
                const maxVel = 1.5;
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > maxVel) {
                    p.vx = (p.vx / speed) * maxVel;
                    p.vy = (p.vy / speed) * maxVel;
                }

                p.x += p.vx;
                p.y += p.vy;

                // Wall bounce (wallBounce: 0.35)
                if (p.x < 0) { p.x = 0; p.vx *= -0.35; }
                if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -0.35; }
                if (p.y < 0) { p.y = 0; p.vy *= -0.35; }
                if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -0.35; }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
            });
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => {
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    const handleMouseMove = (e) => {
        if (isMobile || !sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        
        // For physics
        mouseRef.current = { x: clientX, y: clientY };

        // For CSS parallax (normalized -1 to 1)
        const x = (clientX / rect.width - 0.5) * 2;
        const y = (clientY / rect.height - 0.5) * 2;
        sectionRef.current.style.setProperty('--mouse-x', x);
        sectionRef.current.style.setProperty('--mouse-y', y);
    };

    const handleMouseLeave = () => {
        mouseRef.current = { x: null, y: null };
        if (!sectionRef.current) return;
        sectionRef.current.style.setProperty('--mouse-x', 0);
        sectionRef.current.style.setProperty('--mouse-y', 0);
    };

    // Generate 25 floating dots for the CSS layer
    const cssDots = Array.from({ length: 25 });

    return (
        <section 
            ref={sectionRef} 
            className={`hero-animated-section ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ '--mouse-x': 0, '--mouse-y': 0, ...style }}
        >
            {/* Background Blobs Layer */}
            <div className="hero-bg-blobs">
                <div className="hero-blob h-blob-1" />
                <div className="hero-blob h-blob-2" />
                <div className="hero-blob h-blob-3" />
            </div>

            {/* Dotted Grid Layer */}
            <div className="hero-bg-grid" />

            {/* Canvas Particle Layer (Ballpit equivalent) */}
            <canvas 
                ref={canvasRef} 
                className="hero-ballpit-layer" 
                style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    width: '100%', 
                    height: '100%', 
                    zIndex: 1, 
                    pointerEvents: 'none',
                    opacity: 0.55
                }} 
            />

            {/* CSS Floating Elements Layer */}
            <div className="hero-floating-elements">
                {cssDots.map((_, i) => (
                    <div 
                        key={i} 
                        className={`hero-css-dot ${i % 3 === 0 ? 'hero-css-bubble' : ''}`}
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            width: `${Math.random() * 12 + 4}px`,
                            height: `${Math.random() * 12 + 4}px`,
                            animationDelay: `-${Math.random() * 5}s`,
                            animationDuration: `${Math.random() * 4 + 6}s`,
                            background: ['#2563EB', '#06B6D4', '#7C3AED', '#ffffff'][Math.floor(Math.random() * 4)],
                            opacity: Math.random() * 0.3 + 0.25
                        }}
                    />
                ))}
            </div>

            {/* Content Wrapper */}
            <div className="hero-content">
                {children}
            </div>
        </section>
    );
};

export default HeroAnimatedBackground;
