import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import Home from '../pages/Home';
import UserDashboard from '../pages/UserDashboard';
import Complaints from '../pages/Complaints';
import Expenses from '../pages/Expenses';
import Polls from '../pages/Polls';
import Profile from '../pages/Profile';
import FacilityBookings from '../pages/FacilityBookings';
import GuardDashboard from '../pages/GuardDashboard';
import ResidentDashboard from '../pages/ResidentDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import { useAuthContext } from '../components/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

import ResidentDirectory from '../pages/ResidentDirectory';

import Announcements from '../pages/Announcements';


const ProtectedRoute = ({ children, role }) => {
  const { user } = useAuthContext();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to={`/${user.role}`} />;
  return children;
};

const FeatureRoute = ({ children, feature, fallback = '/dashboard' }) => {
  const featureFlags = useFeatureFlags();
  if (!featureFlags[feature]) return <Navigate to={fallback} replace />;
  return children;
};

const AppRoutes = () => (
  <Router>
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
      <Route path="/directory" element={<ProtectedRoute><ResidentDirectory /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute><FeatureRoute feature="ANNOUNCEMENTS"><Announcements /></FeatureRoute></ProtectedRoute>} />
    </Routes>
  </Router>
);

export default AppRoutes;
