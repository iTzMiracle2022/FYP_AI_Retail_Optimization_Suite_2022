import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import MainLayout from './components/layout/MainLayout';
import DashboardLoadingState from './components/common/DashboardLoadingState';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';

// Lazy Load Page Components for Performance Optimization
const ChurnPrediction = lazy(() => import('./pages/ChurnPrediction'));
const InventoryForecast = lazy(() => import('./pages/InventoryForecast'));
const MarketingAnalysis = lazy(() => import('./pages/MarketingAnalysis'));
const DatasetUpload = lazy(() => import('./pages/DatasetUpload'));
const SalesTrend = lazy(() => import('./pages/SalesAnalysis'));
const Settings = lazy(() => import('./pages/SettingsPage'));
const ProfileSettings = lazy(() => import('./pages/settings/ProfileSettings'));
const RolesSettings = lazy(() => import('./pages/settings/RolesSettings'));
const TeamSettings = lazy(() => import('./pages/settings/TeamSettings'));
const HealthSettings = lazy(() => import('./pages/settings/HealthSettings'));
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'));
const Analytics = lazy(() => import('./pages/AnalyticsPage'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Lazy Load Marketing Pages
const FeaturesPage = lazy(() => import('./pages/marketing/FeaturesPage'));
const PricingPage = lazy(() => import('./pages/marketing/PricingPage'));
const SolutionsPage = lazy(() => import('./pages/marketing/SolutionsPage'));
const DocumentationPage = lazy(() => import('./pages/marketing/DocumentationPage'));
const AboutPage = lazy(() => import('./pages/marketing/AboutPage'));
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'));
const HelpCenterPage = lazy(() => import('./pages/marketing/HelpCenterPage'));
const SecurityPage = lazy(() => import('./pages/marketing/SecurityPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/marketing/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/marketing/TermsOfServicePage'));
const FutureRoadmapPage = lazy(() => import('./pages/marketing/FutureRoadmapPage'));

import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  // 🔗 Reads from .env (VITE_GOOGLE_CLIENT_ID) 🦾
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_ID_HERE";

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AppProvider>
          <AuthProvider>
          <Router>
          <Suspense fallback={
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          }>
          <Routes>
            {/* Public Routes - No Sidebar */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify/:token" element={<VerifyEmail />} />
            <Route path="/forgot" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Marketing & Legal Pages */}
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/roadmap" element={<FutureRoadmapPage />} />

            {/* Managed Private Routes - Protected by Auth & Role */}
            <Route path="/dashboard" element={<MainLayout><ProtectedRoute><Dashboard /></ProtectedRoute></MainLayout>} />
            
            {/* ML & Analytics - Restricted by Role */}
            <Route path="/churn"     element={<MainLayout><ProtectedRoute allowedRoles={['System Admin', 'Manager', 'Analyst']}><ChurnPrediction /></ProtectedRoute></MainLayout>} />
            <Route path="/inventory" element={<MainLayout><ProtectedRoute allowedRoles={['System Admin', 'Manager']}><InventoryForecast /></ProtectedRoute></MainLayout>} />
            <Route path="/marketing" element={<MainLayout><ProtectedRoute allowedRoles={['System Admin', 'Manager', 'Analyst']}><MarketingAnalysis /></ProtectedRoute></MainLayout>} />
            <Route path="/sales"     element={<MainLayout><ProtectedRoute allowedRoles={['System Admin', 'Manager', 'Viewer']}><SalesTrend /></ProtectedRoute></MainLayout>} />
            
            <Route path="/upload"    element={<MainLayout><ProtectedRoute allowedRoles={['Manager', 'System Admin']}><DatasetUpload /></ProtectedRoute></MainLayout>} />
            <Route path="/settings"  element={<MainLayout><ProtectedRoute><Settings /></ProtectedRoute></MainLayout>} />
            <Route path="/settings/profile" element={<MainLayout><ProtectedRoute><ProfileSettings /></ProtectedRoute></MainLayout>} />
            <Route path="/settings/roles" element={<MainLayout><ProtectedRoute><RolesSettings /></ProtectedRoute></MainLayout>} />
            <Route path="/settings/team" element={<MainLayout><ProtectedRoute><TeamSettings /></ProtectedRoute></MainLayout>} />
            <Route path="/settings/health" element={<MainLayout><ProtectedRoute><HealthSettings /></ProtectedRoute></MainLayout>} />
            <Route path="/settings/appearance" element={<MainLayout><ProtectedRoute><AppearanceSettings /></ProtectedRoute></MainLayout>} />
            <Route path="/analytics" element={<MainLayout><ProtectedRoute allowedRoles={['System Admin', 'Manager']}><Analytics /></ProtectedRoute></MainLayout>} />
            
            {/* SuperAdmin Only */}
            {/* <Route path="/admin/connectors" element={<MainLayout><ProtectedRoute allowedRoles={['System Admin']}><AdminSettings /></ProtectedRoute></MainLayout>} /> */}

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
        </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
