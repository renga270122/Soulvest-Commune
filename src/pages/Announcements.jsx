import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useAuthContext } from "../components/AuthContext";

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
      <h2>Announcements & Notices</h2>
      {loading ? <div>Loading...</div> : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {announcements.length === 0 && <li>No announcements yet.</li>}
          {announcements.map(a => (
            <li key={a.id} style={{ marginBottom: "1.5rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
              <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{a.title}</div>
              <div style={{ color: "#888", fontSize: "0.9rem" }}>{a.date?.toDate ? a.date.toDate().toLocaleDateString() : a.date}</div>
              <div style={{ marginTop: "0.5rem" }}>{a.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Announcements;
