import React from 'react';
import Navbar from '../components/Navbar';

export default function Profile() {
  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold mb-4">My Profile</h2>
      <div className="bg-white shadow p-4 rounded mb-4">
        <p>Name: Rahul</p>
        <p>Flat: A-101</p>
        <p>Email: rahul@example.com</p>
        <p>Mobile: 9876543210</p>
      </div>
      <button className="bg-orange-500 text-white px-4 py-2 rounded">Edit Profile</button>
      <Navbar />
    </div>
  );
}
