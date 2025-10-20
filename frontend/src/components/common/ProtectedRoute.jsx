import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Higher-Order Component to protect routes based on authentication 
 * and specific user roles.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        🔐 Authenticating session...
      </div>
    );
  }

  // No user logged in -> Redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role restricted -> Redirect to dashboard (or show unauthorized)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.warn(`User role [${user.role}] is not authorized for this view.`);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
