const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DEMO_SESSION_SECRET = process.env.DEMO_SESSION_SECRET || 'soulvest-demo-session-secret';
const DEMO_SESSION_TTL = process.env.DEMO_SESSION_TTL || '12h';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo123';

const demoUsers = [
  {
    uid: 'user_admin_demo',
    name: 'Aarav Rao',
    email: 'admin@soulvest.demo',
    mobile: '9000000001',
    role: 'admin',
    flat: '',
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: 'en',
    password: DEMO_PASSWORD,
  },
  {
    uid: 'user_guard_demo',
    name: 'Mahesh Kumar',
    email: 'guard@soulvest.demo',
    mobile: '9000000002',
    role: 'guard',
    flat: '',
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: 'en',
    password: DEMO_PASSWORD,
  },
  {
    uid: 'user_resident_demo_1',
    name: 'Priya Nair',
    email: 'resident@soulvest.demo',
    mobile: '9000000003',
    role: 'resident',
    flat: 'A-101',
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: 'en',
    password: DEMO_PASSWORD,
  },
  {
    uid: 'user_resident_demo_2',
    name: 'Karan Shah',
    email: 'resident2@soulvest.demo',
    mobile: '9000000004',
    role: 'resident',
    flat: 'A-102',
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: 'en',
    password: DEMO_PASSWORD,
  },
  {
    uid: 'user_resident_demo_3',
    name: 'Meera Iyer',
    email: 'resident3@soulvest.demo',
    mobile: '9000000005',
    role: 'resident',
    flat: 'B-201',
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: 'en',
    password: DEMO_PASSWORD,
  },
];

function sanitizeDemoUser(user) {
  return {
    uid: user.uid,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    flat: user.flat,
    cityId: user.cityId,
    societyId: user.societyId,
    language: user.language,
    authProvider: 'demo',
  };
}

function findDemoUserByIdentifier(identifier = '') {
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  return demoUsers.find((user) => user.email.toLowerCase() === normalizedIdentifier || user.mobile === normalizedIdentifier) || null;
}

function registerDemoResident({ name, flat, mobile, email, password, language }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedMobile = String(mobile || '').trim();

  if (!name || !flat || !normalizedEmail || !normalizedMobile || !password) {
    const error = new Error('name, flat, mobile, email, and password are required.');
    error.statusCode = 400;
    throw error;
  }

  if (findDemoUserByIdentifier(normalizedEmail)) {
    const error = new Error('A demo user already exists with this email.');
    error.statusCode = 409;
    throw error;
  }

  if (findDemoUserByIdentifier(normalizedMobile)) {
    const error = new Error('A demo user already exists with this mobile number.');
    error.statusCode = 409;
    throw error;
  }

  const user = {
    uid: `user_${crypto.randomUUID()}`,
    name: String(name).trim(),
    email: normalizedEmail,
    mobile: normalizedMobile,
    role: 'resident',
    flat: String(flat).trim().toUpperCase(),
    cityId: 'bengaluru',
    societyId: 'brigade-metropolis',
    language: language || 'en',
    password: String(password),
  };

  demoUsers.push(user);
  return sanitizeDemoUser(user);
}

function createDemoSession({ identifier, password, role }) {
  const user = findDemoUserByIdentifier(identifier);
  if (!user) {
    const error = new Error('No demo user found with this mobile number or email.');
    error.statusCode = 404;
    throw error;
  }

  if (user.password !== password) {
    const error = new Error('Incorrect demo password. Use demo123.');
    error.statusCode = 401;
    throw error;
  }

  if (role && user.role !== role) {
    const error = new Error(`This account is registered as ${user.role}, not ${role}.`);
    error.statusCode = 403;
    throw error;
  }

  const safeUser = sanitizeDemoUser(user);
  const token = jwt.sign(
    {
      sub: safeUser.uid,
      name: safeUser.name,
      email: safeUser.email,
      mobile: safeUser.mobile,
      role: safeUser.role,
      flat: safeUser.flat,
      cityId: safeUser.cityId,
      societyId: safeUser.societyId,
      language: safeUser.language,
      authProvider: 'demo',
    },
    DEMO_SESSION_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: DEMO_SESSION_TTL,
      issuer: 'soulvest-commune-backend',
      audience: 'soulvest-commune-client',
    },
  );

  return {
    token,
    user: safeUser,
  };
}

function verifyDemoSessionToken(token) {
  const decoded = jwt.verify(token, DEMO_SESSION_SECRET, {
    algorithms: ['HS256'],
    issuer: 'soulvest-commune-backend',
    audience: 'soulvest-commune-client',
  });

  return {
    uid: decoded.sub,
    name: decoded.name,
    email: decoded.email,
    mobile: decoded.mobile,
    role: decoded.role,
    flat: decoded.flat,
    cityId: decoded.cityId,
    societyId: decoded.societyId,
    language: decoded.language || 'en',
    authProvider: decoded.authProvider || 'demo',
  };
}

module.exports = {
  createDemoSession,
  registerDemoResident,
  verifyDemoSessionToken,
};