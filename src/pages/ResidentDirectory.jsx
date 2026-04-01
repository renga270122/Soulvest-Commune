import React from "react";

// Sample resident data (replace with backend integration later)
const residents = [
  { flat: "101", name: "Amit Sharma", contact: "9876543210" },
  { flat: "102", name: "Priya Singh", contact: "" },
  { flat: "103", name: "Rahul Mehra", contact: "9876501234" },
  { flat: "104", name: "Sunita Rao", contact: "" },
];

const ResidentDirectory = () => (
  <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
    <h2>Resident Directory</h2>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Flat</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Name</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Contact</th>
        </tr>
      </thead>
      <tbody>
        {residents.map((res, idx) => (
          <tr key={idx}>
            <td>{res.flat}</td>
            <td>{res.name}</td>
            <td>{res.contact || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ResidentDirectory;
