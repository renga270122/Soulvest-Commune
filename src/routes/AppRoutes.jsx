import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Box, CircularProgress } from '@mui/material';
import { useAuthContext } from '../components/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import ResidentDashboard from '../pages/ResidentDashboard';

const LAZY_RETRY_PREFIX = 'soulvest_lazy_retry';

const lazyWithRetry = (importer, routeKey) => lazy(async () => {
  const storageKey = `${LAZY_RETRY_PREFIX}:${routeKey}`;
  const shouldTrackRetry = typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
  const alreadyRetried = shouldTrackRetry && sessionStorage.getItem(storageKey) === 'true';

  try {
    const module = await importer();
    if (shouldTrackRetry) {
      sessionStorage.removeItem(storageKey);
    }
    return module;
  } catch (error) {
    const message = String(error?.message || error || '');
    const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);

    if (isChunkLoadError && shouldTrackRetry && !alreadyRetried) {
      sessionStorage.setItem(storageKey, 'true');
      window.location.reload();
      return new Promise(() => {});
    }

    throw error;
  }
});

const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'), 'login');
const SignupPage = lazyWithRetry(() => import('../pages/SignupPage'), 'signup');
const Home = lazyWithRetry(() => import('../pages/Home'), 'home');
const UserDashboard = lazyWithRetry(() => import('../pages/UserDashboard'), 'dashboard');
const Complaints = lazyWithRetry(() => import('../pages/Complaints'), 'complaints');
const Expenses = lazyWithRetry(() => import('../pages/Expenses'), 'expenses');
const Polls = lazyWithRetry(() => import('../pages/Polls'), 'polls');
const Profile = lazyWithRetry(() => import('../pages/Profile'), 'profile');
const FacilityBookings = lazyWithRetry(() => import('../pages/FacilityBookings'), 'bookings');
const SecurityLogs = lazyWithRetry(() => import('../pages/SecurityLogs'), 'security');
const GuardDashboard = lazyWithRetry(() => import('../pages/GuardDashboard'), 'guard');
const AdminDashboard = lazyWithRetry(() => import('../pages/AdminDashboard'), 'admin');
const ResidentDirectory = lazyWithRetry(() => import('../pages/ResidentDirectory'), 'directory');
const Announcements = lazyWithRetry(() => import('../pages/Announcements'), 'announcements');


const ProtectedRoute = ({ children, role, roles }) => {
  const { user } = useAuthContext();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to={`/${user.role}`} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}`} />;
  return children;
};

const FeatureRoute = ({ children, feature, fallback = '/dashboard' }) => {
  const featureFlags = useFeatureFlags();
  if (!featureFlags[feature]) return <Navigate to={fallback} replace />;
  return children;
};

const RouteFallback = () => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      bgcolor: 'background.default',
    }}
  >
    <CircularProgress />
  </Box>
);

const AppRoutes = () => (
  <Router>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute><FeatureRoute feature="COMPLAINTS"><Complaints /></FeatureRoute></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><FeatureRoute feature="AMENITY_BOOKINGS"><FacilityBookings /></FeatureRoute></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/polls" element={<ProtectedRoute><Polls /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/guard" element={<ProtectedRoute role="guard"><GuardDashboard /></ProtectedRoute>} />
        <Route path="/resident" element={<ProtectedRoute role="resident"><ResidentDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute roles={['admin', 'guard']}><FeatureRoute feature="SECURITY_LOGS"><SecurityLogs /></FeatureRoute></ProtectedRoute>} />
        <Route path="/directory" element={<ProtectedRoute><ResidentDirectory /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><FeatureRoute feature="ANNOUNCEMENTS"><Announcements /></FeatureRoute></ProtectedRoute>} />
      </Routes>
    </Suspense>
  </Router>
);

export default AppRoutes;
