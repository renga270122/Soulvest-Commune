require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();

function parseAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ]
    .map((value) => value && value.trim())
    .filter(Boolean);

  return configuredOrigins;
}

const allowedOrigins = parseAllowedOrigins();

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
}));
app.use(express.json());

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

function getRazorpayMode() {
  if (!process.env.RAZORPAY_KEY_ID) return 'unconfigured';
  if (process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) return 'test';
  if (process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')) return 'live';
  return 'unknown';
}

// LLM Chatbot route
const chatbotLLM = require('./chatbot-llm');
app.use(chatbotLLM);

// Health check
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'soulvest-commune-backend',
    razorpayConfigured: Boolean(razorpay),
    razorpayMode: getRazorpayMode(),
    allowedOrigins,
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'soulvest-commune-backend',
    razorpayConfigured: Boolean(razorpay),
    razorpayMode: getRazorpayMode(),
  });
});



// Firestore
const db = require('./firebase');
const { dispatchNotifications } = require('./notification-service');

function getSocietyCollection(societyId, collectionName) {
  return db.collection('societies').doc(societyId).collection(collectionName);
}

function ensureRazorpayConfigured(res) {
  if (razorpay) return true;

  res.status(503).json({
    error: 'Razorpay is not configured on the backend.',
    details: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET before using the payment gateway.',
  });
  return false;
}

app.post('/feedback', async (req, res) => {
  const {
    name = '',
    flat = '',
    rating,
    category = 'general',
    message,
    source = 'public-feedback-form',
  } = req.body;

  const normalizedRating = Number(rating);
  if (!message) {
    return res.status(400).json({ error: 'message is required.' });
  }

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5.' });
  }

  try {
    const created = await db.collection('residentFeedback').add({
      name: String(name).trim(),
      flat: String(flat).trim(),
      rating: normalizedRating,
      category: String(category).trim() || 'general',
      message: String(message).trim(),
      source,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      ok: true,
      id: created.id,
      message: 'Feedback submitted successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit feedback', details: err.message });
  }
});

app.post('/notifications/dispatch', async (req, res) => {
  const { userId, societyId = 'brigade-metropolis', title, message, channels = {}, meta = {} } = req.body;
  if (!userId || !title || !message) {
    return res.status(400).json({ error: 'userId, title, and message are required' });
  }

  try {
    const userSnapshot = await db.collection('users').doc(userId).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = { id: userSnapshot.id, ...userSnapshot.data() };
    const results = await dispatchNotifications(user, { title, message, channels, meta });

    await db.collection('notificationDispatchLogs').add({
      userId,
      societyId,
      title,
      message,
      channels,
      meta,
      results,
      createdAt: new Date().toISOString(),
    });

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dispatch notifications', details: err.message });
  }
});

// Log a new visitor (Firestore)
app.post('/visitors', async (req, res) => {
  const { name, flat, purpose, time, societyId = 'brigade-metropolis' } = req.body;
  if (!name || !flat || !purpose || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const docRef = await getSocietyCollection(societyId, 'visitors').add({
      name,
      flat,
      purpose,
      time,
      societyId,
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
  const { status, societyId = 'brigade-metropolis' } = req.query;
  try {
    let query = getSocietyCollection(societyId, 'visitors').orderBy('createdAt', 'desc');
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
  const { status, societyId = 'brigade-metropolis' } = req.body;
  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const docRef = getSocietyCollection(societyId, 'visitors').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Visitor not found' });
    await docRef.update({ status });
    res.json({ id, ...doc.data(), status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visitor', details: err.message });
  }
});

app.post('/payments/razorpay/order', async (req, res) => {
  if (!ensureRazorpayConfigured(res)) return;

  const {
    amount,
    currency = 'INR',
    receipt,
    notes = {},
    paymentId,
    userId,
    societyId = 'brigade-metropolis',
    title = 'Soulvest Commune Payment',
  } = req.body;

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ error: 'A valid rupee amount is required.' });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(normalizedAmount * 100),
      currency,
      receipt: receipt || `sv_${Date.now()}`,
      notes: {
        paymentId: paymentId || '',
        userId: userId || '',
        societyId,
        title,
        ...notes,
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      keyId: process.env.RAZORPAY_KEY_ID,
      mode: getRazorpayMode(),
      name: process.env.RAZORPAY_BUSINESS_NAME || 'Soulvest Commune',
      description: title,
      notes: order.notes || {},
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create Razorpay order', details: err.message });
  }
});

app.post('/payments/razorpay/verify', async (req, res) => {
  if (!ensureRazorpayConfigured(res)) return;

  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    paymentId,
    societyId = 'brigade-metropolis',
    userId,
  } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ error: 'Missing Razorpay verification fields.' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Invalid Razorpay signature.' });
    }

    await db.collection('paymentGatewayLogs').add({
      gateway: 'razorpay',
      paymentId: paymentId || '',
      userId: userId || '',
      societyId,
      razorpayOrderId,
      razorpayPaymentId,
      verified: true,
      createdAt: new Date().toISOString(),
    });

    res.json({
      verified: true,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify Razorpay payment', details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
