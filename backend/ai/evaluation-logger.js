const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-evaluations.ndjson');

function summarizeMcpContext(mcpContext = {}) {
  const liveData = mcpContext.liveData || {};
  return {
    actor: {
      uid: mcpContext.actor?.uid || null,
      role: mcpContext.actor?.role || null,
      language: mcpContext.actor?.language || null,
      duesStatus: mcpContext.actor?.duesStatus || null,
      societyId: mcpContext.actor?.societyId || null,
    },
    liveData: {
      pendingDues: liveData.payments?.pendingCount || 0,
      overdueDues: liveData.payments?.overdueCount || 0,
      openComplaints: liveData.complaints?.openCount || 0,
      pendingVisitors: liveData.visitors?.pendingCount || 0,
      deliveries: liveData.visitors?.deliveries?.length || 0,
      staffPresent: liveData.staff?.presentCount || 0,
      staffAlerts: liveData.staff?.alerts?.length || 0,
      announcements: liveData.announcements?.count || 0,
    },
  };
}

async function appendFileLog(entry) {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function appendFirestoreLog(entry, dependencies) {
  if (!dependencies?.getFirebaseStatus || !dependencies?.getDb) {
    return;
  }

  const firebaseStatus = dependencies.getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return;
  }

  try {
    await dependencies.getDb().collection('aiEvaluations').add(entry);
  } catch {
    // File logging remains the baseline even if Firestore is unavailable.
  }
}

async function logAiEvaluation({ route, gateway, request, result, error, responseText, llm, dependencies }) {
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    requestId: gateway?.requestId || null,
    route,
    outcome: error ? 'error' : 'success',
    gateway,
    request: {
      message: request?.message || '',
      executionMode: request?.executionMode || 'preview',
      inputMode: request?.inputMode || 'text',
      channel: request?.channel || gateway?.channel || 'resident-dashboard-chat',
      auth: request?.auth || null,
      contextMeta: request?.contextMeta || null,
    },
    llm: llm || null,
    responseText: responseText || result?.reply || '',
    routing: result?.routing || null,
    agentPlans: Array.isArray(result?.agentPlans) ? result.agentPlans : [],
    decisionTrail: Array.isArray(result?.decisionTrail) ? result.decisionTrail : [],
    collaborationPlans: Array.isArray(result?.collaborationPlans) ? result.collaborationPlans : [],
    tasks: Array.isArray(result?.tasks)
      ? result.tasks.map((task) => ({
          id: task.id,
          type: task.type,
          title: task.title,
          status: task.status,
          executionNote: task.executionNote || '',
        }))
      : [],
    mcpSummary: summarizeMcpContext(result?.mcpContext),
    contextMeta: result?.mcpContext?.contextMeta || request?.contextMeta || null,
    metrics: {
      durationMs: gateway?.durationMs || null,
    },
    error: error
      ? {
          message: error.message,
          statusCode: error.statusCode || 500,
        }
      : null,
  };

  await Promise.allSettled([
    appendFileLog(entry),
    appendFirestoreLog(entry, dependencies),
  ]);

  return entry.id;
}

module.exports = {
  logAiEvaluation,
};