import React from 'react';
import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold mb-4">Namaskara, Rahul!</h2>
      <div className="space-y-4">
        <div className="bg-orange-100 p-4 rounded">📢 Water Tank Cleaning Tomorrow</div>
        <div className="bg-yellow-100 p-4 rounded">🎉 Diwali Celebration Nov 15, 7 PM</div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <button className="bg-white shadow p-2 rounded">Directory</button>
          <button className="bg-white shadow p-2 rounded">Raise Complaint</button>
          <button className="bg-white shadow p-2 rounded">Polls</button>
          <button className="bg-white shadow p-2 rounded">Docs</button>
        </div>
        <div className="mt-4">
          <p>Pending Complaints: 2</p>
          <p>Current Dues: ₹3,500</p>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
