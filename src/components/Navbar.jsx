import React from 'react';
import { NavLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import ReportIcon from '@mui/icons-material/Report';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PollIcon from '@mui/icons-material/Poll';
import PersonIcon from '@mui/icons-material/Person';

const tabs = [
  { label: 'Home', to: '/home', icon: <HomeIcon /> },
  { label: 'Complaints', to: '/complaints', icon: <ReportIcon /> },
  { label: 'Expenses', to: '/expenses', icon: <AccountBalanceWalletIcon /> },
  { label: 'Polls', to: '/polls', icon: <PollIcon /> },
  { label: 'Profile', to: '/profile', icon: <PersonIcon /> },
];

export default function Navbar() {
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
