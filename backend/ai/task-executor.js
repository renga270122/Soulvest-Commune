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

async function executeTaskPlan(tasks, executionMode, dependencies) {
  if (executionMode !== 'execute') {
    return tasks.map((task) => ({
      ...task,
      status: task.status || 'preview',
      executionNote: 'Preview mode only. No persistent changes were made.',
    }));
  }

  const results = [];
  for (const task of tasks) {
    results.push(await queueTask(task, dependencies));
  }
  return results;
}

module.exports = {
  executeTaskPlan,
};