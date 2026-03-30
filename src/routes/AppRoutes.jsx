import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import GuardDashboard from '../pages/GuardDashboard';
import ResidentDashboard from '../pages/ResidentDashboard';
import AdminDashboard from '../pages/AdminDashboard';

const AppRoutes = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/guard" element={<GuardDashboard />} />
      <Route path="/resident" element={<ResidentDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  </Router>
);

export default AppRoutes;
