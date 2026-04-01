import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Home", path: "/resident", icon: "🏠" },
  { label: "Complaints", path: "/complaints", icon: "🛠️" },
  { label: "Expenses", path: "/expenses", icon: "💰" },
  { label: "Polls", path: "/polls", icon: "📊" },
  { label: "Profile", path: "/profile", icon: "👤" },
];

const BottomNav = () => (
  <nav
    style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      background: '#F8F3E7',
      borderTop: '2px solid #E0C9A6',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: 60,
      zIndex: 100,
      boxShadow: '0 -2px 8px #e0c9a6',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    }}
  >
    {navItems.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        style={({ isActive }) => ({
          color: isActive ? '#2456A6' : '#7B6A4D',
          textDecoration: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
        })}
      >
        <span style={{ fontSize: 22 }}>{item.icon}</span>
        {item.label}
      </NavLink>
    ))}
  </nav>
);

export default BottomNav;
