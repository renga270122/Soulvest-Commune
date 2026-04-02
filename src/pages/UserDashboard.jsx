import React, { useState, useEffect } from "react";
import styles from "./UserDashboard.module.css";
import topIllustration from "../assets/top-illustration.png";
import bottomIllustration from "../assets/bottom-illustration.png";
import Navbar from "../components/Navbar";

export default function UserDashboard() {
  // Simulate user info and onboarding state
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("soulvest_onboarded"));
  const [showFlatPrompt, setShowFlatPrompt] = useState(() => !localStorage.getItem("soulvest_flat_verified"));
  const [flat, setFlat] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!showOnboarding) localStorage.setItem("soulvest_onboarded", "1");
    if (!showFlatPrompt) localStorage.setItem("soulvest_flat_verified", "1");
  }, [showOnboarding, showFlatPrompt]);

  // Simulated data
  const userName = name || "Rahul";
  const userFlat = flat || "A-101";
  const currentDues = 3500;
  const pendingComplaints = 2;
  const announcements = [
    { type: "announcement", title: "Water Tank Cleaning Tomorrow", desc: "Undue 6: Cleaning front" },
  ];
  const events = [
    { type: "event", title: "Diwali Celebration", desc: "Nov 15, 7 PM" },
  ];

  return (
    <div className={styles.dashboardBg}>
      <img src={topIllustration} alt="Header" className={styles.headerIllus} />

      {/* Onboarding Prompt */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-2">Welcome to Soulvest Commune!</h2>
            <p className="mb-4">Here's what you can do:</p>
            <ul className="text-left mb-4 list-disc list-inside">
              <li>Raise and track complaints</li>
              <li>View and pay expenses</li>
              <li>Participate in community polls</li>
              <li>Update your profile and more</li>
            </ul>
            <button className="bg-orange-500 text-white px-4 py-2 rounded" onClick={() => setShowOnboarding(false)}>
              Get Started
            </button>
          </div>
        </div>
      )}
      {/* Flat Verification Prompt */}
      {showFlatPrompt && !showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-2">Verify Your Flat Details</h2>
            <p className="mb-4">Please confirm your flat number and name for a personalized experience.</p>
            <input
              className="border rounded px-3 py-2 mb-2 w-full"
              placeholder="Flat Number (e.g., A-101)"
              value={flat}
              onChange={e => setFlat(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2 mb-4 w-full"
              placeholder="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button
              className="bg-orange-500 text-white px-4 py-2 rounded"
              onClick={() => setShowFlatPrompt(false)}
              disabled={!flat || !name}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <div className={styles.dashboardCard}>
        <div className={styles.greeting}>Namaskara, {userName}! <span style={{ color: '#a67c2d', fontWeight: 500 }}>({userFlat})</span></div>
        <div className={styles.announcements}>
          <div style={{ fontWeight: 600, color: '#3a2c0a', marginBottom: 4 }}>Community Announcements</div>
          {announcements.map((a, i) => (
            <div key={i} className={styles.announcementCard}>
              <span>{a.title}</span>
              <span style={{ fontSize: '0.92rem', color: '#a67c2d' }}>{a.desc}</span>
            </div>
          ))}
        </div>
        <div className={styles.announcements}>
          <div style={{ fontWeight: 600, color: '#3a2c0a', marginBottom: 4 }}>Upcoming Event</div>
          {events.map((e, i) => (
            <div key={i} className={styles.eventCard}>
              <span>{e.title}</span>
              <span style={{ fontSize: '0.92rem', color: '#a67c2d' }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ fontWeight: 600, color: '#3a2c0a', margin: '1.1rem 0 0.5rem 0' }}>Quick Stats</div>
        <div className={styles.quickStats}>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Pending Complaints</div>
            <div className={styles.statValue}>{pendingComplaints}</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statLabel}>Current Dues</div>
            <div className={styles.statValue}>₹{currentDues.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ fontWeight: 600, color: '#3a2c0a', margin: '1.1rem 0 0.5rem 0' }}>Shortcuts</div>
        <div className={styles.shortcuts}>
          <button className={styles.shortcutBtn}>Directory</button>
          <button className={styles.shortcutBtn}>Raise Complaint</button>
          <button className={styles.shortcutBtn}>Polls</button>
          <button className={styles.shortcutBtn}>Docs</button>
        </div>
      </div>

      <img src={bottomIllustration} alt="Footer" className={styles.footerIllus} />
      <Navbar />
    </div>
  );
}
