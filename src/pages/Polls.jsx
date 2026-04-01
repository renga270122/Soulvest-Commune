import React from 'react';
import Navbar from '../components/Navbar';

export default function Polls() {
  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold mb-4">Community Polls</h2>
      <div className="bg-white shadow p-4 rounded mb-4">
        <p>Choose the Annual Function Theme</p>
        <button className="bg-orange-500 text-white px-4 py-2 rounded mt-2">Vote Now</button>
      </div>
      <div className="bg-yellow-100 p-4 rounded">
        <p>Traditional Night: 45%</p>
        <p>Bollywood Bash: 30%</p>
        <p>Retro Party: 25%</p>
      </div>
      <Navbar />
    </div>
  );
}
