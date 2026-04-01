import React from "react";

// Sample announcements data (replace with backend integration later)
const announcements = [
  {
    id: 1,
    title: "Water Supply Maintenance",
    date: "2026-04-01",
    content: "Water supply will be interrupted from 10am to 2pm for maintenance work. Please store water in advance."
  },
  {
    id: 2,
    title: "Community Event: Holi Celebration",
    date: "2026-03-28",
    content: "Join us for Holi celebrations in the central park at 5pm. Colors and snacks will be provided!"
  },
  {
    id: 3,
    title: "Security Alert",
    date: "2026-03-25",
    content: "Please ensure all main doors are locked after 10pm. Report any suspicious activity to the security desk."
  }
];

const Announcements = () => (
  <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
    <h2>Announcements & Notices</h2>
    <ul style={{ listStyle: "none", padding: 0 }}>
      {announcements.map(a => (
        <li key={a.id} style={{ marginBottom: "1.5rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{a.title}</div>
          <div style={{ color: "#888", fontSize: "0.9rem" }}>{a.date}</div>
          <div style={{ marginTop: "0.5rem" }}>{a.content}</div>
        </li>
      ))}
    </ul>
  </div>
);

export default Announcements;
