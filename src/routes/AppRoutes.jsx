import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Box, CircularProgress } from '@mui/material';
import { useAuthContext } from '../components/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const Home = lazy(() => import('../pages/Home'));
const UserDashboard = lazy(() => import('../pages/UserDashboard'));
const Complaints = lazy(() => import('../pages/Complaints'));
const Expenses = lazy(() => import('../pages/Expenses'));
const Polls = lazy(() => import('../pages/Polls'));
const Profile = lazy(() => import('../pages/Profile'));
const FacilityBookings = lazy(() => import('../pages/FacilityBookings'));
const SecurityLogs = lazy(() => import('../pages/SecurityLogs'));
const GuardDashboard = lazy(() => import('../pages/GuardDashboard'));
const ResidentDashboard = lazy(() => import('../pages/ResidentDashboard'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const ResidentDirectory = lazy(() => import('../pages/ResidentDirectory'));
const Announcements = lazy(() => import('../pages/Announcements'));


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
