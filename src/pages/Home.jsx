
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../components/AuthContext';
import topIllustration from '../assets/top-illustration.png';
import bottomIllustration from '../assets/bottom-illustration.png';


export default function Home() {
  const navigate = useNavigate();
  const { logout, user } = useAuthContext();
  const [announcement, setAnnouncement] = useState('Water Tank Cleaning Tomorrow');
  const [showDropdown, setShowDropdown] = useState(false);
  const announcements = [
    'Water Tank Cleaning Tomorrow',
    'Elevator Maintenance on Nov 20',
    'Fire Drill on Nov 25',
  ];
  const event = { title: 'Diwali Celebration', date: 'Nov 15, 7 PM' };
  const pendingComplaints = 2;
  const currentDues = 3500;

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #fbe7b2 0%, #fff6e0 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Georgia, serif', position: 'relative', paddingBottom: 80 }}>
      {/* Top Illustration */}
      <img src={topIllustration} alt="Top" style={{ width: '100%', maxWidth: 600, marginBottom: 8 }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 'bold', color: '#5a3a0a' }}>Namaskara, {user?.name || 'Resident'}!</div>
      </div>

      {/* Announcements Dropdown */}
      <div style={{ width: '90%', maxWidth: 420, margin: '0 auto', marginBottom: 10 }}>
        <div style={{ background: '#fff8ec', borderRadius: 12, boxShadow: '0 2px 8px rgba(90,58,10,0.07)', padding: 12, position: 'relative' }}>
          <div style={{ fontWeight: 600, color: '#5a3a0a', marginBottom: 4 }}>Community Announcements</div>
          <button onClick={() => setShowDropdown((v) => !v)} style={{ width: '100%', background: '#fbe7b2', border: 'none', borderRadius: 8, padding: 8, fontWeight: 500, color: '#a67c2d', textAlign: 'left', cursor: 'pointer' }}>{announcement} <span style={{ float: 'right' }}>▼</span></button>
          {showDropdown && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 60, background: '#fff', border: '1px solid #e2c48d', borderRadius: 8, zIndex: 10 }}>
              {announcements.map((a) => (
                <div key={a} style={{ padding: 10, cursor: 'pointer', color: '#5a3a0a' }} onClick={() => { setAnnouncement(a); setShowDropdown(false); }}>{a}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Event */}
      <div style={{ width: '90%', maxWidth: 420, margin: '0 auto', marginBottom: 10 }}>
        <div style={{ background: '#fff8ec', borderRadius: 12, boxShadow: '0 2px 8px rgba(90,58,10,0.07)', padding: 12 }}>
          <div style={{ fontWeight: 600, color: '#5a3a0a', marginBottom: 4 }}>Upcoming Event</div>
          <div style={{ color: '#a67c2d', fontWeight: 500 }}>{event.title}</div>
          <div style={{ color: '#5a3a0a', fontSize: 14 }}>{event.date}</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ width: '90%', maxWidth: 420, margin: '0 auto', marginBottom: 10, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(90,58,10,0.07)', padding: 16, textAlign: 'center' }}>
          <div style={{ color: '#a67c2d', fontWeight: 600, fontSize: 16 }}>{pendingComplaints}</div>
          <div style={{ color: '#5a3a0a', fontSize: 13 }}>Pending Complaints</div>
        </div>
        <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(90,58,10,0.07)', padding: 16, textAlign: 'center' }}>
          <div style={{ color: '#a67c2d', fontWeight: 600, fontSize: 16 }}>₹{currentDues.toLocaleString()}</div>
          <div style={{ color: '#5a3a0a', fontSize: 13 }}>Current Dues</div>
        </div>
      </div>

      {/* Bottom Illustration */}
      <img src={bottomIllustration} alt="Bottom" style={{ width: '100%', maxWidth: 600, marginTop: 24, marginBottom: 80 }} />

      <button onClick={handleLogout} style={{ marginBottom: 24, background: '#5a3a0a', color: '#fff8ec', border: 'none', borderRadius: 999, padding: '10px 18px', cursor: 'pointer' }}>
        Exit Demo Session
      </button>

      {/* Bottom Navigation */}
      <Navbar />
    </div>
  );
}
