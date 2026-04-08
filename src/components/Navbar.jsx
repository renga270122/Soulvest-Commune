import React from 'react';
import { NavLink } from 'react-router-dom';
import ReportIcon from '@mui/icons-material/Report';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PersonIcon from '@mui/icons-material/Person';
import CampaignIcon from '@mui/icons-material/Campaign';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useAuthContext } from '../components/auth-context';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

export default function Navbar() {
  const { user } = useAuthContext();
  const featureFlags = useFeatureFlags();
  const dashboardRoute = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'guard'
      ? '/guard'
      : '/resident';
  const tabs = [
    { label: 'Dashboard', to: dashboardRoute, icon: <DashboardIcon /> },
    ...(featureFlags.ANNOUNCEMENTS ? [{ label: 'Notices', to: '/announcements', icon: <CampaignIcon /> }] : []),
    ...(featureFlags.AMENITY_BOOKINGS ? [{ label: 'Amenities', to: '/bookings', icon: <EventAvailableIcon /> }] : []),
    ...(featureFlags.COMPLAINTS ? [{ label: 'Complaints', to: '/complaints', icon: <ReportIcon /> }] : []),
    { label: 'Dues', to: '/expenses', icon: <AccountBalanceWalletIcon /> },
    { label: 'Profile', to: '/profile', icon: <PersonIcon /> },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white shadow-md flex justify-around py-2 z-10 border-t">
      {tabs.map(({ label, to, icon }) => (
        <NavLink
          key={label}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-orange-600 font-bold' : 'text-gray-700'} hover:text-orange-600`
          }
        >
          {icon}
          <span style={{ fontSize: 12, marginTop: 2 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
