import React from 'react';
import { motion } from 'framer-motion';
import './PremiumCard.css';

export const PremiumCard = ({ children, color = "#2563EB", delay = 0, className = "", isPrimary = false, padding = "2rem", style = {}, noGlow = false, isStatic = false, disableAnimation = false }) => {
  const handleMouseMove = (e) => {
    if (noGlow || isStatic) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const hoverProps = {};

  return (
    <motion.div
      className={`premium-card ${isPrimary ? 'primary-card' : ''} ${noGlow || isStatic ? 'no-glow' : ''} ${isStatic ? 'is-static' : ''} ${className}`}
      onMouseMove={handleMouseMove}
      initial={disableAnimation ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
      whileInView={disableAnimation ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={disableAnimation ? { duration: 0 } : { duration: 0.5, delay, ease: "easeOut" }}
      viewport={disableAnimation ? undefined : { once: true, margin: "-50px" }}
      {...hoverProps}
      style={{ 
        ...style,
        padding,
        '--card-padding': padding,
        '--card-accent': color, 
        '--card-accent-soft': isPrimary ? 'rgba(255,255,255,0.1)' : `${color}15`, 
        '--card-accent-glow': isPrimary ? 'rgba(255,255,255,0.2)' : `${color}30` 
      }}
    >
      {!(noGlow || isStatic) && <div className="card-glow" />}
      <div className="card-content">
        {children}
        {!(isPrimary || noGlow || isStatic) && <div className="card-bottom-line" />}
      </div>
    </motion.div>
  );
};

export const PremiumIconBox = ({ icon: Icon, color, size = 22, style = {} }) => (
    <div className="card-icon-box" style={style}>
        <Icon size={size} color={color || "var(--card-accent)"} className="card-icon" />
    </div>
);
