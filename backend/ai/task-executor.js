function isTaskApproved(taskId, approvedTaskIds) {
  return Array.isArray(approvedTaskIds) && approvedTaskIds.includes(taskId);
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

  const results = [];
  for (const task of tasks) {
    results.push(await executeOneTask(task, options, dependencies));
  }
  return results;
}

module.exports = {
  executeTaskPlan,
};