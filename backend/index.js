require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('API is running');
});



// Firestore
const db = require('./firebase');

// Log a new visitor (Firestore)
app.post('/visitors', async (req, res) => {
  const { name, flat, purpose, time } = req.body;
  if (!name || !flat || !purpose || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const docRef = await db.collection('visitors').add({
      name,
      flat,
      purpose,
      time,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    const doc = await docRef.get();
    res.status(201).json({ id: docRef.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add visitor', details: err.message });
  }
});

// Get all visitors (optionally filter by status)
app.get('/visitors', async (req, res) => {
  const { status } = req.query;
  try {
    let query = db.collection('visitors').orderBy('createdAt', 'desc');
    if (status) {
      query = query.where('status', '==', status);
    }
    const snapshot = await query.get();
    const visitors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(visitors);
  } catch (err) {
    console.error('Error fetching visitors:', err);
    res.status(500).json({ error: 'Failed to fetch visitors', details: err.message, stack: err.stack });
  }
});

// Update visitor status (approve/deny)
app.patch('/visitors/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const docRef = db.collection('visitors').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Visitor not found' });
    await docRef.update({ status });
    res.json({ id, ...doc.data(), status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visitor', details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
