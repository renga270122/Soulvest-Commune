import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 w-full bg-white shadow-md flex justify-around py-2 z-10">
      {['Home', 'Complaints', 'Expenses', 'Polls', 'Profile'].map((tab) => (
        <NavLink
          key={tab}
          to={`/${tab.toLowerCase()}`}
          className={({ isActive }) =>
            `text-sm ${isActive ? 'text-orange-600 font-bold' : 'text-gray-700'} hover:text-orange-600`
          }
        >
          {tab}
        </NavLink>
      ))}
    </nav>
  );
}
