require('dotenv').config();

const { getDb, getFirebaseStatus } = require('../firebase');
const { dispatchNotifications } = require('../notification-service');

const DEFAULT_POLL_MS = Number(process.env.AI_TASK_WORKER_POLL_MS || 15000);
const DEFAULT_BATCH_SIZE = Number(process.env.AI_TASK_WORKER_BATCH_SIZE || 5);
const WORKER_ID = process.env.AI_TASK_WORKER_ID || `ai-worker-${process.pid}`;

function nowIso() {
  return new Date().toISOString();
}

function getSocietyCollection(db, societyId, collectionName) {
  return db.collection('societies').doc(societyId).collection(collectionName);
}

function buildAnnouncementDraft(task) {
  const topic = String(task.payload?.topic || '').trim();
  const compactTopic = topic.replace(/\s+/g, ' ').trim();
  const title = compactTopic
    ? `Draft: ${compactTopic.slice(0, 72)}`
    : 'Draft: Society announcement';

  return {
    title,
    body: compactTopic || 'AI-generated draft announcement. Review before publishing.',
  };
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

async function logNotificationDispatch(db, task, results, title, message) {
  await db.collection('notificationDispatchLogs').add({
    taskId: task.id,
    taskType: task.type,
    title,
    message,
    societyId: task.payload?.societyId || null,
    userId: task.payload?.userId || null,
    results,
    createdAt: nowIso(),
  });
}

async function handlePaymentReminder(task, db) {
  const user = await getUserById(db, task.payload?.userId);
  if (!user) {
    throw new Error('Payment reminder target user was not found.');
  }

  const title = task.payload?.title || 'Maintenance payment reminder';
  const message = task.payload?.message || `You have pending society dues${task.payload?.remindAt ? ` scheduled for ${task.payload.remindAt}` : ''}.`;
  const channels = task.payload?.channels || { push: true, email: true, sms: false };

  const results = await dispatchNotifications(user, {
    title,
    message,
    channels,
    meta: {
      taskType: task.type,
      remindAt: task.payload?.remindAt || '',
      taskId: task.id,
    },
  });

  await logNotificationDispatch(db, task, results, title, message);

  return {
    results,
    executionNote: `Payment reminder dispatched to ${user.name || user.id}.`,
  };
}

async function handleDeliveryRouting(task, db) {
  const societyId = task.payload?.societyId;
  const visitorId = task.payload?.visitorId;
  const route = task.payload?.route;

  if (!societyId || !visitorId || !route) {
    throw new Error('Delivery routing task is missing visitor, route, or society context.');
  }

  const visitorRef = getSocietyCollection(db, societyId, 'visitors').doc(visitorId);
  const visitorSnapshot = await visitorRef.get();
  if (!visitorSnapshot.exists) {
    throw new Error('Delivery visitor record was not found.');
  }

  const visitor = visitorSnapshot.data();
  const update = route === 'doorstep'
    ? {
        status: 'approved',
        deliveryStatus: 'doorstep',
        updatedAt: nowIso(),
        routedAt: nowIso(),
        routedBy: 'ai-task-worker',
      }
    : {
        status: 'approved',
        deliveryStatus: 'security_hold_requested',
        updatedAt: nowIso(),
        routedAt: nowIso(),
        routedBy: 'ai-task-worker',
      };

  await visitorRef.update(update);

  const targets = [];
  const residentUser = await getUserById(db, visitor.residentId);
  if (residentUser) {
    targets.push({
      user: residentUser,
      payload: {
        title: route === 'doorstep' ? 'Delivery approved to doorstep' : 'Delivery routed to security',
        message: route === 'doorstep'
          ? `${visitor.vendorName || visitor.name} will be sent to your doorstep.`
          : `${visitor.vendorName || visitor.name} will be held at the security desk until collection.`,
      },
    });
  }

  if (route === 'security') {
    const guardUser = await findGuardForSociety(db, societyId);
    if (guardUser) {
      targets.push({
        user: guardUser,
        payload: {
          title: 'Parcel assigned to security desk',
          message: `${visitor.vendorName || visitor.name} for Flat ${visitor.flat} should be held at the security desk.`,
        },
      });
    }
  }

  const results = [];
  for (const target of targets) {
    const dispatchResult = await dispatchNotifications(target.user, {
      ...target.payload,
      channels: { push: true, email: false, sms: false },
      meta: {
        taskType: task.type,
        route,
        visitorId,
        taskId: task.id,
      },
    });

    results.push({ userId: target.user.id, results: dispatchResult });
  }

  return {
    results,
    executionNote: `Delivery ${visitor.vendorName || visitor.name} routed to ${route}.`,
  };
}

async function handleAnnouncementDraft(task, db) {
  const societyId = task.payload?.societyId;
  if (!societyId) {
    throw new Error('Announcement draft task is missing society context.');
  }

  const draft = buildAnnouncementDraft(task);
  const created = await getSocietyCollection(db, societyId, 'announcements').add({
    title: draft.title,
    body: draft.body,
    language: task.payload?.language || 'en',
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
    announcementId: created.id,
    executionNote: `Announcement draft created with id ${created.id}.`,
  };
}

async function processTask(task, db) {
  if (task.type === 'payment-reminder') {
    return handlePaymentReminder(task, db);
  }

  if (task.type === 'delivery-routing-preview') {
    return handleDeliveryRouting(task, db);
  }

  if (task.type === 'announcement-draft') {
    return handleAnnouncementDraft(task, db);
  }

  return {
    executionNote: `No dedicated worker handler exists for ${task.type}.`,
    skipped: true,
  };
}

async function claimQueuedTask(db, doc) {
  const docRef = doc.ref;
  const claimed = await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(docRef);
    if (!fresh.exists) return null;
    const data = fresh.data();
    if (data.status !== 'queued') return null;

    transaction.update(docRef, {
      status: 'processing',
      processingStartedAt: nowIso(),
      workerId: WORKER_ID,
      updatedAt: nowIso(),
    });

    return { id: fresh.id, ref: docRef, ...data };
  });

  return claimed;
}

async function processClaimedTask(claimedTask, db) {
  try {
    const result = await processTask(claimedTask, db);
    await claimedTask.ref.update({
      status: result?.skipped ? 'skipped' : 'completed',
      completedAt: nowIso(),
      updatedAt: nowIso(),
      workerId: WORKER_ID,
      executionNote: result.executionNote || '',
      lastResult: result,
    });

    return { taskId: claimedTask.id, status: result?.skipped ? 'skipped' : 'completed' };
  } catch (error) {
    await claimedTask.ref.update({
      status: 'failed',
      failedAt: nowIso(),
      updatedAt: nowIso(),
      workerId: WORKER_ID,
      executionNote: error.message,
      lastError: {
        message: error.message,
        at: nowIso(),
      },
    });

    return { taskId: claimedTask.id, status: 'failed', error: error.message };
  }
}

async function runWorkerCycle(options = {}) {
  const firebaseStatus = getFirebaseStatus();
  if (!firebaseStatus.configured) {
    throw new Error(firebaseStatus.message);
  }

  const db = getDb();
  const batchSize = Number(options.batchSize || DEFAULT_BATCH_SIZE);
  const snapshot = await db.collection('aiTaskQueue').where('status', '==', 'queued').limit(batchSize).get();

  if (snapshot.empty) {
    return [];
  }

  const results = [];
  for (const doc of snapshot.docs) {
    const claimedTask = await claimQueuedTask(db, doc);
    if (!claimedTask) continue;
    results.push(await processClaimedTask(claimedTask, db));
  }

  return results;
}

async function startWorker(options = {}) {
  const runOnce = Boolean(options.runOnce);
  const pollMs = Number(options.pollMs || DEFAULT_POLL_MS);

  const runCycle = async () => {
    const results = await runWorkerCycle(options);
    if (results.length) {
      console.log(`[${WORKER_ID}] processed tasks:`, JSON.stringify(results));
    } else {
      console.log(`[${WORKER_ID}] no queued tasks found`);
    }
  };

  if (runOnce) {
    await runCycle();
    return;
  }

  console.log(`[${WORKER_ID}] task worker started with poll interval ${pollMs}ms`);
  await runCycle();
  setInterval(() => {
    runCycle().catch((error) => {
      console.error(`[${WORKER_ID}] worker cycle failed:`, error.message);
    });
  }, pollMs);
}

if (require.main === module) {
  const runOnce = process.argv.includes('--once') || process.env.AI_TASK_WORKER_RUN_ONCE === 'true';
  startWorker({ runOnce }).catch((error) => {
    console.error(`[${WORKER_ID}] task worker failed to start:`, error.message);
    process.exit(1);
  });
}

module.exports = {
  runWorkerCycle,
  startWorker,
};