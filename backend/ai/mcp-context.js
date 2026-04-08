function sortByDateDescending(items, field) {
  return [...items].sort((left, right) => new Date(right[field] || 0).getTime() - new Date(left[field] || 0).getTime());
}

function sortByDateAscending(items, field) {
  return [...items].sort((left, right) => new Date(left[field] || 0).getTime() - new Date(right[field] || 0).getTime());
}

function buildPaymentSummary(payments) {
  const pending = payments.filter((payment) => (payment.derivedStatus || payment.status) !== 'paid');
  const now = Date.now();
  const totalPending = pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const nextDue = sortByDateAscending(pending.filter((payment) => payment.dueDate), 'dueDate')[0] || null;
  const overdueCount = pending.filter((payment) => {
    if (!payment.dueDate) return false;
    const dueTime = new Date(payment.dueDate).getTime();
    return !Number.isNaN(dueTime) && dueTime < now;
  }).length;

  return {
    count: payments.length,
    pendingCount: pending.length,
    totalPending,
    overdueCount,
    duesStatus: pending.length ? (overdueCount ? 'overdue' : 'pending') : 'clear',
    nextDue,
    items: sortByDateDescending(payments, 'createdAt').slice(0, 5),
  };
}

function buildComplaintSummary(complaints) {
  const open = complaints.filter((complaint) => complaint.status !== 'resolved');
  return {
    count: complaints.length,
    openCount: open.length,
    urgentCount: open.filter((complaint) => complaint.aiPriority === 'high').length,
    latest: sortByDateDescending(complaints, 'createdAt').slice(0, 5),
  };
}

function buildBookingSummary(bookings) {
  const active = bookings.filter((booking) => booking.status !== 'cancelled');
  return {
    count: bookings.length,
    activeCount: active.length,
    next: sortByDateAscending(active.filter((booking) => booking.bookingDate), 'bookingDate')[0] || null,
    items: sortByDateAscending(bookings, 'bookingDate').slice(0, 5),
  };
}

function buildStaffSummary(staffMembers, staffAttendance) {
  const present = staffAttendance.filter((entry) => entry.status !== 'absent');
  return {
    registeredCount: staffMembers.length,
    autoApprovedCount: staffMembers.filter((entry) => entry.autoApproved).length,
    registeredNames: staffMembers.map((entry) => entry.name).filter(Boolean),
    count: staffAttendance.length,
    presentCount: present.length,
    alerts: staffAttendance.filter((entry) => entry.alertMessage).slice(0, 3),
    latest: sortByDateDescending(staffAttendance, 'clockInAt').slice(0, 5),
  };
}

function buildVisitorSummary(visitors, user) {
  const scopedVisitors = visitors.filter((visitor) => {
    if (user?.role === 'resident') {
      return visitor.residentId === user.uid || visitor.flat === user.flat;
    }
    return true;
  });

  const pending = scopedVisitors.filter((visitor) => visitor.status === 'pending');
  const deliveries = scopedVisitors.filter((visitor) => String(visitor.purpose || '').toLowerCase() === 'delivery');

  return {
    count: scopedVisitors.length,
    pendingCount: pending.length,
    pending,
    deliveries,
    latest: sortByDateDescending(scopedVisitors, 'createdAt').slice(0, 5),
  };
}

function buildAnnouncementSummary(announcements) {
  const ordered = sortByDateDescending(announcements, 'createdAt');
  return {
    count: announcements.length,
    latest: ordered.slice(0, 3),
    pinned: ordered.filter((announcement) => announcement.pinned).slice(0, 3),
  };
}

function buildMcpContext({ message, user = {}, chatHistory = [], contextSnapshot = {} }) {
  const payments = Array.isArray(contextSnapshot.payments) ? contextSnapshot.payments : [];
  const complaints = Array.isArray(contextSnapshot.complaints) ? contextSnapshot.complaints : [];
  const bookings = Array.isArray(contextSnapshot.bookings) ? contextSnapshot.bookings : [];
  const staffMembers = Array.isArray(contextSnapshot.staffMembers) ? contextSnapshot.staffMembers : [];
  const staffAttendance = Array.isArray(contextSnapshot.staffAttendance) ? contextSnapshot.staffAttendance : [];
  const visitors = Array.isArray(contextSnapshot.visitors) ? contextSnapshot.visitors : [];
  const announcements = Array.isArray(contextSnapshot.announcements) ? contextSnapshot.announcements : [];
  const paymentSummary = buildPaymentSummary(payments);

  return {
    protocol: 'soulvest.mcp/1.0',
    request: {
      message,
      timestamp: new Date().toISOString(),
      history: chatHistory.slice(-6),
    },
    actor: {
      uid: user.uid || null,
      name: user.name || 'Resident',
      role: user.role || 'resident',
      flat: user.flat || null,
      societyId: user.societyId || 'brigade-metropolis',
      language: user.language || 'en',
      duesStatus: paymentSummary.duesStatus,
    },
    residentContext: {
      householdInfo: user.householdInfo || null,
      residentId: user.uid || null,
      role: user.role || 'resident',
      duesStatus: paymentSummary.duesStatus,
      preferences: {
        language: user.language || 'en',
      },
    },
    societyContext: {
      societyId: user.societyId || 'brigade-metropolis',
      rules: Array.isArray(contextSnapshot.rules) ? contextSnapshot.rules : [],
    },
    liveData: {
      payments: paymentSummary,
      complaints: buildComplaintSummary(complaints),
      bookings: buildBookingSummary(bookings),
      staff: buildStaffSummary(staffMembers, staffAttendance),
      visitors: buildVisitorSummary(visitors, user),
      announcements: buildAnnouncementSummary(announcements),
    },
  };
}

function createPromptContext(mcpContext, routing, collaborationPlans = []) {
  const { actor, liveData, request } = mcpContext;
  const pendingVisitorNames = liveData.visitors.pending.map((visitor) => visitor.name).join(', ') || 'none';
  const latestAnnouncementTitles = liveData.announcements.latest.map((announcement) => announcement.title).join(' | ') || 'none';
  const nextBooking = liveData.bookings.next ? `${liveData.bookings.next.amenity} on ${liveData.bookings.next.bookingDate}` : 'none';
  const nextDue = liveData.payments.nextDue ? `${liveData.payments.nextDue.title || 'payment'} on ${liveData.payments.nextDue.dueDate}` : 'none';
  const collaborationSummary = collaborationPlans.length
    ? collaborationPlans.map((plan) => `${plan.title}: ${plan.summary}`).join(' | ')
    : 'none';

  return [
    'Soulvest MCP Context',
    `Actor: ${actor.name} (${actor.role}) flat=${actor.flat || 'n/a'} society=${actor.societyId} language=${actor.language} duesStatus=${actor.duesStatus}`,
    `Intents: ${routing.intents.join(', ') || 'general_concierge'}`,
    `Pending dues: ${liveData.payments.pendingCount} totaling INR ${liveData.payments.totalPending}`,
    `Overdue dues: ${liveData.payments.overdueCount}`,
    `Next due: ${nextDue}`,
    `Open complaints: ${liveData.complaints.openCount}`,
    `Next booking: ${nextBooking}`,
    `Staff present count: ${liveData.staff.presentCount}`,
    `Registered staff count: ${liveData.staff.registeredCount}`,
    `Pending visitors: ${liveData.visitors.pendingCount} (${pendingVisitorNames})`,
    `Latest announcements: ${latestAnnouncementTitles}`,
    `Cross-agent collaboration: ${collaborationSummary}`,
    `Latest user message: ${request.message}`,
  ].join('\n');
}

module.exports = {
  buildMcpContext,
  createPromptContext,
};