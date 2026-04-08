const { dispatchNotifications } = require('../notification-service');

function isTaskApproved(taskId, approvedTaskIds) {
  return Array.isArray(approvedTaskIds) && approvedTaskIds.includes(taskId);
}

function nowIso() {
  return new Date().toISOString();
}

function getSocietyCollection(db, societyId, collectionName) {
  return db.collection('societies').doc(societyId).collection(collectionName);
}

function toIsoOrNow(value) {
  if (!value) return nowIso();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
}

async function getUserById(db, userId) {
  if (!userId) return null;
  const snapshot = await db.collection('users').doc(userId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

async function findGuardForSociety(db, societyId) {
  const snapshot = await db.collection('users').where('societyId', '==', societyId).limit(25).get();
  const guard = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .find((user) => user.role === 'guard');

  return guard || null;
}

function ensureRole(actor, allowedRoles, title) {
  if (allowedRoles.includes(actor?.role)) {
    return null;
  }

  return {
    status: 'blocked',
    executionNote: `${title} is not allowed for role ${actor?.role || 'unknown'}.`,
  };
}

async function executeVisitorStatusUpdate(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['resident', 'admin', 'guard'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so visitor execution remains a preview only.',
    };
  }

  const db = getDb();
  const docRef = db.collection('societies').doc(task.payload.societyId).collection('visitors').doc(task.payload.visitorId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Visitor could not be found for execution.',
    };
  }

  const visitor = snapshot.data();
  if (actor.role === 'resident' && visitor.residentId && visitor.residentId !== actor.uid) {
    return {
      ...task,
      status: 'blocked',
      executionNote: 'Residents can only execute visitor actions for their own flat.',
    };
  }

  await docRef.update({
    status: task.payload.status,
    updatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: actor.name || actor.uid || actor.role,
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `${task.payload.visitorName || 'Visitor'} was marked ${task.payload.status}.`,
  };
}

async function executeComplaintCreate(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['resident', 'admin', 'guard'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so complaint execution remains a preview only.',
    };
  }

  const db = getDb();
  const payload = {
    category: task.payload.category,
    description: task.payload.description,
    residentId: task.payload.residentId || actor.uid || null,
    residentName: task.payload.residentName || actor.name || 'Resident',
    flat: task.payload.flat || actor.flat || null,
    societyId: task.payload.societyId,
    status: 'open',
    aiPriority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByAgent: true,
  };

  const created = await db.collection('societies').doc(task.payload.societyId).collection('complaints').add(payload);

  return {
    ...task,
    status: 'completed',
    executionNote: `Complaint created with id ${created.id}.`,
    payload: {
      ...task.payload,
      complaintId: created.id,
    },
  };
}

async function executeVisitorCreate(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['guard', 'admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so visitor logging remains a preview only.',
    };
  }

  const createdAt = nowIso();
  const payload = {
    name: task.payload?.visitorName || 'Walk-in visitor',
    flat: task.payload?.flat || '',
    purpose: task.payload?.purpose || 'Guest visit',
    time: task.payload?.time || createdAt,
    societyId: task.payload?.societyId || actor.societyId,
    residentId: task.payload?.residentId || '',
    residentName: task.payload?.residentName || '',
    phone: task.payload?.phone || '',
    status: 'pending',
    entryMethod: 'walk-in',
    createdAt,
    updatedAt: createdAt,
    history: [{ type: 'pending', actor: actor.name || actor.uid || 'Guard', at: createdAt }],
  };

  const db = getDb();
  const created = await getSocietyCollection(db, payload.societyId, 'visitors').add(payload);

  return {
    ...task,
    status: 'completed',
    executionNote: `${payload.name} was logged for Flat ${payload.flat || 'unknown'}.`,
    payload: {
      ...task.payload,
      visitorId: created.id,
      visitorName: payload.name,
      time: payload.time,
    },
  };
}

async function executeVisitorVerifyPass(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['guard', 'admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so pass verification remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  const code = String(task.payload?.code || '').trim();
  if (!societyId || !code) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Pass verification is missing society or OTP context.',
    };
  }

  const db = getDb();
  const snapshot = await getSocietyCollection(db, societyId, 'visitors').where('otp', '==', code).limit(1).get();
  if (snapshot.empty) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'No visitor pass matched that OTP.',
    };
  }

  const doc = snapshot.docs[0];
  const visitor = doc.data();
  if (!['preapproved', 'approved'].includes(visitor.status)) {
    return {
      ...task,
      status: 'blocked',
      executionNote: 'That pass is not ready for verification or has already been used.',
    };
  }

  await doc.ref.update({
    status: 'checked_in',
    passState: 'used',
    checkedInAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `${visitor.name || visitor.visitorName || 'Visitor'} checked in successfully.`,
    payload: {
      ...task.payload,
      visitorId: doc.id,
      visitorName: visitor.name || visitor.visitorName || 'Visitor',
      status: 'checked_in',
    },
  };
}

async function executeVisitorCheckIn(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['guard', 'admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so visitor check-in remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  const visitorId = task.payload?.visitorId;
  if (!societyId || !visitorId) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Visitor check-in is missing society or visitor context.',
    };
  }

  const db = getDb();
  const docRef = getSocietyCollection(db, societyId, 'visitors').doc(visitorId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Visitor could not be found for check-in.',
    };
  }

  const visitor = snapshot.data();
  await docRef.update({
    status: 'checked_in',
    checkedInAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `${visitor.name || task.payload?.visitorName || 'Visitor'} checked in successfully.`,
    payload: {
      ...task.payload,
      status: 'checked_in',
    },
  };
}

async function executeVisitorCheckOut(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['guard', 'admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so visitor check-out remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  const visitorId = task.payload?.visitorId;
  if (!societyId || !visitorId) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Visitor check-out is missing society or visitor context.',
    };
  }

  const db = getDb();
  const docRef = getSocietyCollection(db, societyId, 'visitors').doc(visitorId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Visitor could not be found for check-out.',
    };
  }

  const visitor = snapshot.data();
  await docRef.update({
    status: 'checked_out',
    exitTime: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `${visitor.name || task.payload?.visitorName || 'Visitor'} checked out successfully.`,
    payload: {
      ...task.payload,
      status: 'checked_out',
    },
  };
}

async function executeDeliveryRouting(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['resident', 'admin', 'guard'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so delivery routing remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId;
  const visitorId = task.payload?.visitorId;
  const route = task.payload?.route;

  if (!societyId || !visitorId) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Delivery routing is missing visitor or society context.',
    };
  }

  if (!['doorstep', 'security'].includes(route)) {
    return {
      ...task,
      status: 'blocked',
      executionNote: `Delivery route ${route || 'unknown'} cannot be executed directly.`,
    };
  }

  const db = getDb();
  const docRef = getSocietyCollection(db, societyId, 'visitors').doc(visitorId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Delivery visitor record could not be found for execution.',
    };
  }

  const visitor = snapshot.data();
  if (actor.role === 'resident' && visitor.residentId && visitor.residentId !== actor.uid) {
    return {
      ...task,
      status: 'blocked',
      executionNote: 'Residents can only route deliveries for their own flat.',
    };
  }

  const routedAt = nowIso();
  const update = route === 'doorstep'
    ? {
        status: 'approved',
        deliveryStatus: 'doorstep',
        routedAt,
        routedBy: actor.name || actor.uid || actor.role,
        updatedAt: routedAt,
      }
    : {
        status: 'approved',
        deliveryStatus: 'security_hold_requested',
        collectedBy: '',
        routedAt,
        routedBy: actor.name || actor.uid || actor.role,
        updatedAt: routedAt,
      };

  await docRef.update(update);

  const residentUser = await getUserById(db, visitor.residentId);
  const guardUser = route === 'security' ? await findGuardForSociety(db, societyId) : null;
  const notificationTargets = [
    residentUser && {
      user: residentUser,
      payload: {
        title: route === 'doorstep' ? 'Delivery approved to doorstep' : 'Parcel will be held at security',
        message: route === 'doorstep'
          ? `${visitor.vendorName || visitor.name} will be sent to your doorstep.`
          : `${visitor.vendorName || visitor.name} will be held at the security desk until collection.`,
      },
    },
    guardUser && {
      user: guardUser,
      payload: {
        title: 'Parcel assigned to security desk',
        message: `${visitor.vendorName || visitor.name} for Flat ${visitor.flat} should be held at the security desk.`,
      },
    },
  ].filter(Boolean);

  for (const target of notificationTargets) {
    await dispatchNotifications(target.user, {
      ...target.payload,
      channels: { push: true, email: false, sms: false },
      meta: {
        taskType: task.type,
        taskId: task.id,
        route,
        visitorId,
      },
    });
  }

  return {
    ...task,
    status: 'completed',
    executionNote: `Delivery ${visitor.vendorName || visitor.name} routed to ${route}.`,
    payload: {
      ...task.payload,
      deliveryStatus: update.deliveryStatus,
      routedAt,
    },
  };
}

async function executePaymentReminder(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['resident', 'admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so payment reminders remain a preview only.',
    };
  }

  const db = getDb();
  const targetUserId = task.payload?.userId || actor.uid;
  const user = await getUserById(db, targetUserId) || (targetUserId === actor.uid ? {
    id: actor.uid,
    name: actor.name,
    email: actor.email,
    mobile: actor.mobile,
    societyId: actor.societyId,
    role: actor.role,
  } : null);
  if (!user) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'The payment reminder target user could not be found.',
    };
  }

  if (actor.role === 'resident' && user.id !== actor.uid) {
    return {
      ...task,
      status: 'blocked',
      executionNote: 'Residents can only send reminders for their own account.',
    };
  }

  const title = task.payload?.title || 'Maintenance payment reminder';
  const message = task.payload?.message || `You have pending society dues${task.payload?.remindAt ? ` scheduled for ${task.payload.remindAt}` : ''}.`;
  const results = await dispatchNotifications(user, {
    title,
    message,
    channels: task.payload?.channels || { push: true, email: true, sms: false },
    meta: {
      taskType: task.type,
      taskId: task.id,
      remindAt: task.payload?.remindAt || '',
    },
  });

  await db.collection('notificationDispatchLogs').add({
    taskId: task.id,
    taskType: task.type,
    title,
    message,
    societyId: task.payload?.societyId || actor.societyId || null,
    userId: user.id,
    results,
    createdAt: nowIso(),
    createdByAgent: true,
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `Payment reminder dispatched to ${user.name || user.id}.`,
    payload: {
      ...task.payload,
      dispatchedTo: user.id,
      dispatchedAt: nowIso(),
    },
  };
}

async function executePaymentCreateCharge(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so charge creation remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  const targetResidents = Array.isArray(task.payload?.targetResidents) ? task.payload.targetResidents : [];
  if (!societyId || !targetResidents.length) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Charge creation needs at least one target resident.',
    };
  }

  const db = getDb();
  const createdAt = nowIso();
  await Promise.all(targetResidents.map((resident) => getSocietyCollection(db, societyId, 'payments').add({
    userId: resident.id,
    residentName: resident.name || 'Resident',
    flat: resident.flat || '',
    societyId,
    title: task.payload?.title || 'Monthly Maintenance',
    amount: Number(task.payload?.amount || 0),
    dueDate: toIsoOrNow(task.payload?.dueDate),
    breakdown: task.payload?.breakdown || { Security: 40, Housekeeping: 25, Utilities: 20, Other: 15 },
    status: 'pending',
    method: 'manual',
    createdAt,
    updatedAt: createdAt,
    createdByAgent: true,
  })));

  return {
    ...task,
    status: 'completed',
    executionNote: `Charge created for ${targetResidents.length} resident${targetResidents.length === 1 ? '' : 's'}.`,
  };
}

async function executeComplaintStatusUpdate(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so complaint updates remain a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  const complaintId = task.payload?.complaintId;
  if (!societyId || !complaintId) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Complaint update is missing society or complaint context.',
    };
  }

  const db = getDb();
  const docRef = getSocietyCollection(db, societyId, 'complaints').doc(complaintId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Complaint could not be found for update.',
    };
  }

  const status = task.payload?.status || 'resolved';
  await docRef.update({
    status,
    updatedAt: nowIso(),
    resolvedAt: status === 'resolved' ? nowIso() : null,
    resolutionNote: task.payload?.resolutionNote || '',
    lastUpdatedBy: actor.name || actor.uid || 'Admin',
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `Complaint ${complaintId} was marked ${status}.`,
  };
}

async function executeAnnouncementDraft(task, actor, dependencies) {
  const roleError = ensureRole(actor, ['admin'], task.title);
  if (roleError) {
    return { ...task, ...roleError };
  }

  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so announcement drafting remains a preview only.',
    };
  }

  const societyId = task.payload?.societyId || actor.societyId;
  if (!societyId) {
    return {
      ...task,
      status: 'failed',
      executionNote: 'Announcement draft is missing society context.',
    };
  }

  const db = getDb();
  const topic = String(task.payload?.topic || '').trim().replace(/\s+/g, ' ');
  const title = topic ? `Draft: ${topic.slice(0, 72)}` : 'Draft: Society announcement';
  const body = topic || 'AI-generated draft announcement. Review before publishing.';
  const created = await getSocietyCollection(db, societyId, 'announcements').add({
    title,
    body,
    language: task.payload?.language || actor.language || 'en',
    pinned: false,
    audience: 'all',
    acknowledgements: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdByAgent: true,
    publishState: 'draft',
    taskId: task.id,
  });

  return {
    ...task,
    status: 'completed',
    executionNote: `Announcement draft created with id ${created.id}.`,
    payload: {
      ...task.payload,
      announcementId: created.id,
    },
  };
}

async function queueTask(task, dependencies) {
  const { getFirebaseStatus, getDb } = dependencies;
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Firebase is not configured, so this task is returned as a preview only.',
    };
  }

  const db = getDb();
  const payload = {
    ...task,
    queuedAt: new Date().toISOString(),
  };

  await db.collection('aiTaskQueue').add(payload);

  return {
    ...task,
    status: 'queued',
    executionNote: 'Queued in aiTaskQueue for downstream processing.',
  };
}

async function executeOneTask(task, options, dependencies) {
  if (!isTaskApproved(task.id, options.approvedTaskIds) || !options.requireConfirmation) {
    return {
      ...task,
      status: 'preview',
      executionNote: 'Explicit confirmation is required before this task can run.',
    };
  }

  if (task.type === 'visitor-status-update') {
    return executeVisitorStatusUpdate(task, options.actor, dependencies);
  }

  if (task.type === 'complaint-create') {
    return executeComplaintCreate(task, options.actor, dependencies);
  }

  if (task.type === 'delivery-routing-preview') {
    return executeDeliveryRouting(task, options.actor, dependencies);
  }

  if (task.type === 'visitor-create') {
    return executeVisitorCreate(task, options.actor, dependencies);
  }

  if (task.type === 'visitor-verify-pass') {
    return executeVisitorVerifyPass(task, options.actor, dependencies);
  }

  if (task.type === 'visitor-check-in') {
    return executeVisitorCheckIn(task, options.actor, dependencies);
  }

  if (task.type === 'visitor-check-out') {
    return executeVisitorCheckOut(task, options.actor, dependencies);
  }

  if (task.type === 'payment-reminder') {
    return executePaymentReminder(task, options.actor, dependencies);
  }

  if (task.type === 'payment-create-charge') {
    return executePaymentCreateCharge(task, options.actor, dependencies);
  }

  if (task.type === 'complaint-status-update') {
    return executeComplaintStatusUpdate(task, options.actor, dependencies);
  }

  if (task.type === 'announcement-draft') {
    return executeAnnouncementDraft(task, options.actor, dependencies);
  }

  return queueTask(task, dependencies);
}

async function executeTaskPlan(tasks, options, dependencies) {
  if (options.executionMode !== 'execute') {
    return tasks.map((task) => ({
      ...task,
      status: task.status || 'preview',
      executionNote: task.requiresConfirmation
        ? 'Preview only. Confirm this task explicitly before execution.'
        : 'Preview mode only. No persistent changes were made.',
    }));
  }

  if (!options.auth?.authenticated || !options.actor?.uid) {
    return tasks.map((task) => ({
      ...task,
      status: 'blocked',
      executionNote: 'Authenticated server-side approval is required before this task can run.',
    }));
  }

  const results = [];
  for (const task of tasks) {
    results.push(await executeOneTask(task, options, dependencies));
  }
  return results;
}

module.exports = {
  executeTaskPlan,
};