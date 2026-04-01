import React from 'react';
import Navbar from '../components/Navbar';

export default function Expenses() {
  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold mb-4">Expenses</h2>
      <div className="bg-white shadow p-4 rounded mb-4">
        <p>Maintenance Due: ₹3,500</p>
        <p>Due by: Nov 30</p>
      </div>
      <div className="bg-orange-100 p-4 rounded">
        <p>Security: 40%</p>
        <p>Housekeeping: 25%</p>
        <p>Utilities: 20%</p>
        <p>Other: 15%</p>
      </div>
      <Navbar />
    </div>
  );
}
