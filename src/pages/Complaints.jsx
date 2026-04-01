import React from 'react';
import Navbar from '../components/Navbar';

export default function Complaints() {
  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold mb-4">Complaints</h2>
      <button className="bg-orange-500 text-white px-4 py-2 rounded mb-4">Raise New Complaint</button>
      <div className="space-y-4">
        <div className="bg-white shadow p-4 rounded">
          <p>Leaky Faucet</p>
          <p>Status: In Progress</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <p>Lift Not Working</p>
          <p>Status: Resolved</p>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
