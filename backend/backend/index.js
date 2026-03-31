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


// In-memory visitor storage
let visitors = [];
let nextVisitorId = 1;

// Log a new visitor
app.post('/visitors', (req, res) => {
  const { name, flat, purpose, time } = req.body;
  if (!name || !flat || !purpose || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const visitor = {
    id: nextVisitorId++,
    name,
    flat,
    purpose,
    time,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  visitors.unshift(visitor);
  res.status(201).json(visitor);
});

// Get all visitors (optionally filter by status)
app.get('/visitors', (req, res) => {
  const { status } = req.query;
  if (status) {
    return res.json(visitors.filter(v => v.status === status));
  }
  res.json(visitors);
});

// Update visitor status (approve/deny)
app.patch('/visitors/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const visitor = visitors.find(v => v.id === parseInt(id));
  if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  visitor.status = status;
  res.json(visitor);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
