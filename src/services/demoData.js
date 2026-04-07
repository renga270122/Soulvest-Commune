import { DEFAULT_SOCIETY_ID } from '../config/firestore';
import {
  createId,
  findDemoUserById,
  mutateDemoState,
  nowIso,
  normalizeFlatValue,
  sanitizeUser,
  subscribeDemoState,
} from './demoStore';

export const normalizeFlat = (flat) => normalizeFlatValue(flat);

const clone = (value) => JSON.parse(JSON.stringify(value));

const resolveSocietyId = (context) => {
  if (typeof context === 'string' && context) return context;
  return context?.societyId || DEFAULT_SOCIETY_ID;
};

const getComparableTime = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const toDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDerivedPaymentStatus = (payment) => {
  if (payment.status === 'paid') return 'paid';
  const dueDate = toDateValue(payment.dueDate);
  if (dueDate && dueDate.getTime() < Date.now()) return 'overdue';
  return payment.status === 'due' ? 'pending' : (payment.status || 'pending');
};

const getComplaintPriority = (description = '', category = '') => {
  const text = `${category} ${description}`.toLowerCase();
  if (/(fire|gas|security|lift|elevator|flood|electric shock|sparking)/.test(text)) return 'high';
  if (/(water|plumbing|electrical|maintenance|leak)/.test(text)) return 'medium';
  return 'low';
};

const createOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const createPassToken = () => `SV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const buildQrPayload = (passToken, otp) => JSON.stringify({ type: 'soulvest-pass', passToken, otp });
const createReceiptNumber = () => `RCP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const createBookingCode = () => `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const sortByCreatedDesc = (items) => items.sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt));

const getPassExpiryDate = (visitorOrPass) => {
  const explicitExpiry = toDateValue(visitorOrPass?.passExpiresAt);
  if (explicitExpiry) return explicitExpiry;
  const expectedAt = toDateValue(visitorOrPass?.expectedAt);
  if (!expectedAt) return null;
  return new Date(expectedAt.getTime() + 2 * 60 * 60 * 1000);
};

const parseVerificationCode = (code) => {
  const cleaned = String(code || '').trim();
  if (!cleaned) return { otp: '', passToken: '' };
  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      return { otp: parsed.otp || '', passToken: parsed.passToken || '' };
    } catch {
      return { otp: cleaned, passToken: cleaned };
    }
  }
  return { otp: cleaned, passToken: cleaned };
};

const appendNotification = (state, notification) => {
  state.notifications.push({
    id: createId('notification'),
    read: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    societyId: notification.societyId || DEFAULT_SOCIETY_ID,
    ...notification,
  });
};

const appendVisitorHistory = (visitor, type, actor) => {
  visitor.history = visitor.history || [];
  visitor.history.push({
    type,
    actor: actor?.name || actor?.actor || 'System',
    at: nowIso(),
  });
};

const findResidentByFlat = (state, flat, societyId) => state.users.find((user) => (
  user.role === 'resident' && user.societyId === societyId && normalizeFlat(user.flat) === normalizeFlat(flat)
)) || null;

export async function getUserProfileByUid(uid) {
  return sanitizeUser(findDemoUserById(uid));
}

export async function upsertUserProfile(uid, data) {
  mutateDemoState((state) => {
    const existing = state.users.find((user) => user.id === uid);
    if (existing) {
      Object.assign(existing, {
        ...data,
        flat: normalizeFlat(data.flat ?? existing.flat),
        updatedAt: nowIso(),
      });
      return state;
    }

    state.users.push({
      id: uid,
      role: 'resident',
      language: 'en',
      societyId: data.societyId || DEFAULT_SOCIETY_ID,
      cityId: data.cityId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...data,
      flat: normalizeFlat(data.flat),
    });
    return state;
  });
}

export function subscribeToResidents(callback) {
  return subscribeDemoState(
    (state) => state.users
      .filter((resident) => resident.role !== 'guard' && resident.role !== 'admin')
      .map((resident) => ({ ...sanitizeUser(resident), flat: normalizeFlat(resident.flat) || 'UNASSIGNED' }))
      .sort((left, right) => `${left.flat}-${left.name || ''}`.localeCompare(`${right.flat}-${right.name || ''}`)),
    callback,
  );
}

export function subscribeToVisitors(callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.visitors
      .filter((visitor) => visitor.societyId === societyId)
      .map((visitor) => ({ ...visitor, flat: normalizeFlat(visitor.flat) }))
      .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    callback,
  );
}

export function subscribeToAnnouncements(callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.announcements
      .filter((announcement) => announcement.societyId === societyId)
      .sort((left, right) => {
        if (Boolean(left.pinned) !== Boolean(right.pinned)) {
          return left.pinned ? -1 : 1;
        }
        return getComparableTime(right.createdAt) - getComparableTime(left.createdAt);
      }),
    callback,
  );
}

export function subscribeToComplaints(callback, filters = {}) {
  const societyId = resolveSocietyId(filters.context);
  return subscribeDemoState(
    (state) => state.complaints
      .filter((complaint) => complaint.societyId === societyId)
      .filter((complaint) => !filters.residentId || complaint.residentId === filters.residentId)
      .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    callback,
  );
}

export function subscribeToResidentComplaints(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  return subscribeToComplaints(callback, { residentId: userId, context });
}

export function subscribeToFacilityBookings(callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.facilityBookings
      .filter((booking) => booking.societyId === societyId)
      .sort((left, right) => getComparableTime(left.bookingDate) - getComparableTime(right.bookingDate)),
    callback,
  );
}

export function subscribeToResidentFacilityBookings(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.facilityBookings
      .filter((booking) => booking.societyId === societyId && booking.residentId === userId)
      .sort((left, right) => getComparableTime(left.bookingDate) - getComparableTime(right.bookingDate)),
    callback,
  );
}

export function subscribeToStaffAttendance(callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.staffAttendance
      .filter((entry) => entry.societyId === societyId)
      .sort((left, right) => getComparableTime(right.clockInAt || right.createdAt) - getComparableTime(left.clockInAt || left.createdAt)),
    callback,
  );
}

export function subscribeToMyAttendance(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.staffAttendance
      .filter((entry) => entry.societyId === societyId && entry.userId === userId)
      .sort((left, right) => getComparableTime(right.clockInAt || right.createdAt) - getComparableTime(left.clockInAt || left.createdAt)),
    callback,
  );
}

export async function createVisitor(visitor) {
  const societyId = resolveSocietyId(visitor);
  mutateDemoState((state) => {
    const resident = findResidentByFlat(state, visitor.flat, societyId);
    const entry = {
      id: createId('visitor'),
      name: visitor.name,
      phone: visitor.phone || '',
      purpose: visitor.purpose,
      flat: normalizeFlat(visitor.flat),
      residentId: resident?.id || visitor.residentId || '',
      residentName: resident?.name || visitor.residentName || '',
      societyId,
      status: 'pending',
      time: visitor.time,
      entryMethod: 'walk-in',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      history: [{ type: 'pending', actor: visitor.loggedByName || 'Guard', at: nowIso() }],
    };
    state.visitors.push(entry);
    if (resident?.id) {
      appendNotification(state, {
        userId: resident.id,
        title: 'Visitor waiting at the gate',
        message: `${visitor.name} is waiting for approval at Flat ${entry.flat}.`,
        type: 'visitor-awaiting-approval',
        visitorId: entry.id,
        flat: entry.flat,
        societyId,
      });
    }
    return state;
  });
}

export async function createVisitorPass(pass) {
  const expectedAt = toDateValue(pass.expectedAt);
  if (!expectedAt || expectedAt.getTime() < Date.now()) {
    throw new Error('Expected arrival time must be in the future.');
  }

  const otp = createOtp();
  const passToken = createPassToken();
  const qrPayload = buildQrPayload(passToken, otp);
  const passExpiresAt = getPassExpiryDate({ expectedAt: expectedAt.toISOString() })?.toISOString();
  const societyId = resolveSocietyId(pass);
  const created = {
    id: createId('visitor'),
    visitorName: pass.visitorName,
    name: pass.visitorName,
    phone: pass.phone || '',
    purpose: pass.purpose,
    notes: pass.notes || '',
    flat: normalizeFlat(pass.flat),
    residentId: pass.residentId,
    residentName: pass.residentName,
    societyId,
    expectedAt: expectedAt.toISOString(),
    passExpiresAt,
    otp,
    passToken,
    qrPayload,
    passState: 'active',
    status: 'preapproved',
    entryMethod: 'resident-pass',
    history: [{ type: 'preapproved', actor: pass.residentName || 'Resident', at: nowIso() }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  mutateDemoState((state) => {
    state.visitors.push(created);
    appendNotification(state, {
      userId: pass.residentId,
      title: 'Visitor pass created',
      message: `OTP ${otp} is ready for ${pass.visitorName}.`,
      type: 'visitor-pass-created',
      visitorId: created.id,
      flat: created.flat,
      societyId,
    });
    return state;
  });

  return clone(created);
}

export async function verifyVisitorPass(code, guardUser) {
  const { otp, passToken } = parseVerificationCode(code);
  const societyId = resolveSocietyId(guardUser);
  let verifiedVisitor = null;

  mutateDemoState((state) => {
    const visitor = state.visitors.find((entry) => entry.societyId === societyId && (entry.otp === otp || entry.passToken === passToken));
    if (!visitor) {
      throw new Error('No pre-approved visitor pass found for this OTP or QR payload.');
    }
    const expiry = getPassExpiryDate(visitor);
    if (expiry && expiry.getTime() < Date.now()) {
      visitor.status = 'expired';
      visitor.passState = 'expired';
      visitor.updatedAt = nowIso();
      appendVisitorHistory(visitor, 'expired', guardUser);
      throw new Error('This visitor pass has expired. Ask the resident to create a new pass.');
    }
    visitor.status = 'checked_in';
    visitor.passState = 'used';
    visitor.checkedInAt = nowIso();
    visitor.updatedAt = nowIso();
    appendVisitorHistory(visitor, 'checked_in', guardUser);
    if (visitor.residentId) {
      appendNotification(state, {
        userId: visitor.residentId,
        title: 'Visitor entered',
        message: `${visitor.name} has entered Soulvest Commune.`,
        type: 'visitor-entered',
        visitorId: visitor.id,
        flat: visitor.flat,
        societyId,
      });
    }
    verifiedVisitor = clone(visitor);
    return state;
  });

  return verifiedVisitor;
}

export async function updateVisitorStatus(id, status, actor = {}) {
  mutateDemoState((state) => {
    const visitor = state.visitors.find((entry) => entry.id === id);
    if (!visitor) throw new Error('Visitor not found.');
    visitor.status = status;
    visitor.updatedAt = nowIso();
    appendVisitorHistory(visitor, status, actor);
    return state;
  });
}

export async function checkInVisitor(visitorId, guardUser) {
  mutateDemoState((state) => {
    const visitor = state.visitors.find((entry) => entry.id === visitorId);
    if (!visitor) throw new Error('Visitor not found.');
    visitor.status = 'checked_in';
    visitor.checkedInAt = nowIso();
    visitor.updatedAt = nowIso();
    appendVisitorHistory(visitor, 'checked_in', guardUser);
    if (visitor.residentId) {
      appendNotification(state, {
        userId: visitor.residentId,
        title: 'Visitor entered',
        message: `${visitor.name} has entered Soulvest Commune.`,
        type: 'visitor-entered',
        visitorId: visitor.id,
        flat: visitor.flat,
        societyId: visitor.societyId,
      });
    }
    return state;
  });
}

export async function checkOutVisitor(visitorId, guardUser) {
  mutateDemoState((state) => {
    const visitor = state.visitors.find((entry) => entry.id === visitorId);
    if (!visitor) throw new Error('Visitor not found.');
    visitor.status = 'checked_out';
    visitor.exitTime = nowIso();
    visitor.updatedAt = nowIso();
    appendVisitorHistory(visitor, 'checked_out', guardUser);
    if (visitor.residentId) {
      appendNotification(state, {
        userId: visitor.residentId,
        title: 'Visitor exited',
        message: `${visitor.name} has exited Soulvest Commune.`,
        type: 'visitor-exited',
        visitorId: visitor.id,
        flat: visitor.flat,
        societyId: visitor.societyId,
      });
    }
    return state;
  });
}

export async function createPaymentRecord(payment) {
  const created = {
    id: createId('payment'),
    status: 'pending',
    method: 'manual',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...payment,
  };
  mutateDemoState((state) => {
    state.payments.push(created);
    return state;
  });
  return clone(created);
}

export async function clockInStaff(actor = {}, extra = {}) {
  let result = null;
  mutateDemoState((state) => {
    const existing = state.staffAttendance.find((entry) => entry.userId === actor.uid && entry.status === 'clocked_in');
    if (existing) {
      result = clone(existing);
      return state;
    }
    const attendance = {
      id: createId('attendance'),
      userId: actor.uid,
      name: actor.name || 'Staff',
      role: actor.role || 'guard',
      shift: extra.shift || 'general',
      societyId: resolveSocietyId(actor),
      status: 'clocked_in',
      clockInAt: nowIso(),
      clockOutAt: null,
      notes: extra.notes || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.staffAttendance.push(attendance);
    result = clone(attendance);
    return state;
  });
  return result;
}

export async function clockOutStaff(attendanceId, actor = {}, extra = {}) {
  mutateDemoState((state) => {
    const attendance = state.staffAttendance.find((entry) => entry.id === attendanceId)
      || state.staffAttendance.find((entry) => entry.userId === actor.uid && entry.status === 'clocked_in');
    if (!attendance) throw new Error('No active shift found to clock out.');
    attendance.status = 'clocked_out';
    attendance.clockOutAt = nowIso();
    attendance.notes = extra.notes || attendance.notes || '';
    attendance.updatedAt = nowIso();
    return state;
  });
}

export async function markPaymentAsPaid(paymentId, extra = {}) {
  mutateDemoState((state) => {
    const payment = state.payments.find((entry) => entry.id === paymentId);
    if (!payment) throw new Error('Payment record not found.');
    Object.assign(payment, {
      status: 'paid',
      paidAt: extra.paidAt || nowIso(),
      updatedAt: nowIso(),
      receiptNumber: extra.receiptNumber || createReceiptNumber(),
      receiptIssuedAt: extra.receiptIssuedAt || nowIso(),
      paidAmount: Number(extra.paidAmount || extra.amount || payment.amount || 0),
      ...extra,
    });
    return state;
  });
}

export function subscribeToPayments(callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.payments
      .filter((payment) => payment.societyId === societyId)
      .map((payment) => ({ ...payment, derivedStatus: getDerivedPaymentStatus(payment) }))
      .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    callback,
  );
}

export function subscribeToResidentPayments(userId, callback, context = DEFAULT_SOCIETY_ID) {
  const societyId = resolveSocietyId(context);
  return subscribeDemoState(
    (state) => state.payments
      .filter((payment) => payment.societyId === societyId && payment.userId === userId)
      .map((payment) => ({ ...payment, derivedStatus: getDerivedPaymentStatus(payment) }))
      .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    callback,
  );
}

export async function seedResidentPaymentIfMissing(user) {
  if (!user?.uid) return;
  const now = new Date();
  const title = 'Monthly Maintenance';
  mutateDemoState((state) => {
    const exists = state.payments.some((payment) => payment.userId === user.uid && payment.title === title && payment.month === String(now.getMonth() + 1).padStart(2, '0') && payment.year === now.getFullYear());
    if (exists) return state;
    state.payments.push({
      id: createId('payment'),
      userId: user.uid,
      residentName: user.name || 'Resident',
      flat: user.flat,
      societyId: resolveSocietyId(user),
      title,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(),
      amount: 3500,
      breakdown: { Security: 40, Housekeeping: 25, Utilities: 20, Other: 15 },
      status: 'pending',
      method: 'manual',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: now.getFullYear(),
    });
    return state;
  });
}

export async function createAnnouncement(announcement) {
  const created = {
    id: createId('announcement'),
    societyId: resolveSocietyId(announcement),
    title: announcement.title,
    body: announcement.body,
    language: announcement.language || 'en',
    pinned: Boolean(announcement.pinned),
    postedBy: announcement.postedBy || null,
    audience: announcement.audience || 'all',
    acknowledgements: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mutateDemoState((state) => {
    state.announcements.push(created);
    return state;
  });
}

export async function acknowledgeAnnouncement(announcementId, user) {
  mutateDemoState((state) => {
    const announcement = state.announcements.find((entry) => entry.id === announcementId);
    if (!announcement) throw new Error('Announcement not found.');
    announcement.acknowledgements = announcement.acknowledgements || [];
    if (!announcement.acknowledgements.some((entry) => entry.userId === user?.uid)) {
      announcement.acknowledgements.push({ userId: user?.uid, at: nowIso() });
      announcement.updatedAt = nowIso();
    }
    return state;
  });
}

export async function createComplaint(complaint) {
  const created = {
    id: createId('complaint'),
    category: complaint.category,
    description: complaint.description,
    residentId: complaint.residentId,
    residentName: complaint.residentName,
    flat: normalizeFlat(complaint.flat),
    societyId: resolveSocietyId(complaint),
    status: 'open',
    aiPriority: getComplaintPriority(complaint.description, complaint.category),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mutateDemoState((state) => {
    state.complaints.push(created);
    return state;
  });
}

export async function updateComplaintStatus(complaintId, status, actor = {}, extra = {}) {
  mutateDemoState((state) => {
    const complaint = state.complaints.find((entry) => entry.id === complaintId);
    if (!complaint) throw new Error('Complaint not found.');
    complaint.status = status;
    complaint.updatedAt = nowIso();
    complaint.resolvedAt = status === 'resolved' ? nowIso() : complaint.resolvedAt;
    complaint.lastUpdatedBy = actor?.name || 'Admin';
    complaint.resolutionNote = extra.resolutionNote || complaint.resolutionNote;
    return state;
  });
}

export async function createFacilityBooking(booking) {
  const societyId = resolveSocietyId(booking);
  let created = null;
  mutateDemoState((state) => {
    const hasConflict = state.facilityBookings.some((entry) => (
      entry.societyId === societyId
      && entry.amenity === booking.amenity
      && entry.bookingDate === booking.bookingDate
      && entry.slot === booking.slot
      && entry.status !== 'cancelled'
    ));
    if (hasConflict) {
      throw new Error('That amenity slot is already reserved. Please pick another time.');
    }
    created = {
      id: createId('booking'),
      residentId: booking.residentId,
      residentName: booking.residentName,
      flat: normalizeFlat(booking.flat),
      societyId,
      amenity: booking.amenity,
      bookingDate: booking.bookingDate,
      slot: booking.slot,
      guestCount: Number(booking.guestCount || 1),
      notes: booking.notes || '',
      status: 'confirmed',
      bookingCode: createBookingCode(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.facilityBookings.push(created);
    return state;
  });
  return clone(created);
}

export async function cancelFacilityBooking(bookingId) {
  mutateDemoState((state) => {
    const booking = state.facilityBookings.find((entry) => entry.id === bookingId);
    if (!booking) throw new Error('Booking not found.');
    booking.status = 'cancelled';
    booking.updatedAt = nowIso();
    return state;
  });
}

export async function seedDemoDayData({ adminUser, residents = [] } = {}) {
  const societyId = resolveSocietyId(adminUser);
  mutateDemoState((state) => {
    const resident = residents[0] || state.users.find((entry) => entry.role === 'resident');
    if (!resident) return state;

    state.announcements.push({
      id: createId('announcement'),
      title: 'Emergency Fire Drill',
      body: 'A short fire drill will be held in the parking area at 6 PM today.',
      audience: 'all',
      pinned: false,
      postedBy: { uid: adminUser?.uid || '', name: adminUser?.name || 'Admin' },
      acknowledgements: [],
      societyId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    state.complaints.push({
      id: createId('complaint'),
      residentId: resident.id,
      residentName: resident.name,
      flat: normalizeFlat(resident.flat),
      societyId,
      category: 'electrical',
      description: 'Corridor light near the lift lobby is flickering.',
      status: 'open',
      aiPriority: 'medium',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    state.payments.push({
      id: createId('payment'),
      userId: resident.id,
      residentName: resident.name,
      flat: resident.flat,
      societyId,
      title: 'Quarterly Sinking Fund',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      amount: 1500,
      breakdown: { ReserveFund: 100 },
      status: 'pending',
      method: 'manual',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    state.visitors.push({
      id: createId('visitor'),
      name: 'Demo Courier',
      phone: '9876500077',
      purpose: 'Delivery',
      flat: normalizeFlat(resident.flat),
      residentId: resident.id,
      residentName: resident.name,
      societyId,
      status: 'pending',
      time: 'Today 7:15 PM',
      entryMethod: 'walk-in',
      history: [{ type: 'pending', actor: adminUser?.name || 'Admin', at: nowIso() }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return state;
  });
}

export function subscribeToNotifications(userId, callback) {
  if (!userId) return () => {};
  return subscribeDemoState(
    (state) => sortByCreatedDesc(state.notifications.filter((notification) => notification.userId === userId)),
    callback,
  );
}

export async function markNotificationAsRead(notificationId) {
  mutateDemoState((state) => {
    const notification = state.notifications.find((entry) => entry.id === notificationId);
    if (notification) {
      notification.read = true;
      notification.updatedAt = nowIso();
    }
    return state;
  });
}
