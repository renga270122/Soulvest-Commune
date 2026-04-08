const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const port = process.env.AI_SMOKE_TEST_PORT || '4011';
const baseUrl = `http://127.0.0.1:${port}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function waitForServer(child) {
  let lastError = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(`Backend exited early with code ${child.exitCode}.`);
    }

    try {
      return await fetchJson(`${baseUrl}/health`);
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw lastError || new Error('Timed out waiting for backend health endpoint.');
}

async function createDemoSession(identifier, role) {
  return fetchJson(`${baseUrl}/auth/demo-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: 'demo123', role }),
  });
}

async function runPreviewFlow() {
  const previewPayload = {
    message: 'Please route my latest delivery to security and raise a complaint for damaged packaging',
    user: {
      uid: 'resident-demo-1',
      name: 'Ananya Rao',
      role: 'resident',
      flat: 'A-1204',
      societyId: 'brigade-metropolis',
      language: 'en',
    },
    contextSnapshot: {
      payments: [],
      complaints: [],
      bookings: [],
      staffMembers: [],
      staffAttendance: [],
      visitors: [
        {
          id: 'visitor-preview-1',
          name: 'Amazon Parcel',
          purpose: 'delivery',
          flat: 'A-1204',
          residentId: 'resident-demo-1',
          societyId: 'brigade-metropolis',
          status: 'pending',
          createdAt: '2026-04-08T09:00:00.000Z',
        },
      ],
      announcements: [],
    },
    executionMode: 'preview',
    inputMode: 'voice',
    channel: 'resident-dashboard-chat',
  };

  const preview = await fetchJson(`${baseUrl}/agent-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(previewPayload),
  });

  assert.equal(preview.ok, true);
  assert.deepEqual(preview.routing.agents, ['delivery', 'complaint']);
  assert.equal(preview.gateway.inputMode, 'voice');
  assert.equal(preview.tasks[0].status, 'preview');
  assert.equal(preview.tasks[1].status, 'preview');
}

async function runExecuteFlows() {
  const residentSession = await createDemoSession('resident@soulvest.demo', 'resident');

  const createdVisitor = await fetchJson(`${baseUrl}/visitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test Parcel',
      flat: residentSession.user.flat,
      purpose: 'delivery',
      time: '12:30 PM',
      societyId: residentSession.user.societyId,
    }),
  });

  const residentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${residentSession.token}`,
  };

  const deliveryExecute = await fetchJson(`${baseUrl}/agent-message`, {
    method: 'POST',
    headers: residentHeaders,
    body: JSON.stringify({
      message: 'Send my latest delivery to security',
      user: residentSession.user,
      contextSnapshot: {
        payments: [],
        complaints: [],
        bookings: [],
        staffMembers: [],
        staffAttendance: [],
        visitors: [createdVisitor],
        announcements: [],
      },
      executionMode: 'execute',
      inputMode: 'text',
      channel: 'resident-dashboard-chat',
      approvedTaskIds: ['delivery-delivery-routing-preview-1'],
      requireConfirmation: true,
    }),
  });

  assert.equal(deliveryExecute.tasks[0].status, 'completed');
  assert.equal(deliveryExecute.tasks[0].payload.deliveryStatus, 'security_hold_requested');
  assert.equal(deliveryExecute.mcpContext.liveData.visitors.pendingCount, 0);
  assert.equal(deliveryExecute.mcpContext.liveData.visitors.deliveries[0].deliveryStatus, 'security_hold_requested');

  const financeExecute = await fetchJson(`${baseUrl}/agent-message`, {
    method: 'POST',
    headers: residentHeaders,
    body: JSON.stringify({
      message: 'Remind me about my maintenance dues today',
      user: residentSession.user,
      contextSnapshot: {
        payments: [
          {
            id: 'payment-smoke-1',
            userId: residentSession.user.uid,
            societyId: residentSession.user.societyId,
            title: 'Monthly Maintenance',
            amount: 3500,
            status: 'pending',
            dueDate: '2026-04-28T00:00:00.000Z',
            createdAt: '2026-04-08T09:00:00.000Z',
          },
        ],
        complaints: [],
        bookings: [],
        staffMembers: [],
        staffAttendance: [],
        visitors: [],
        announcements: [],
      },
      executionMode: 'execute',
      inputMode: 'text',
      channel: 'resident-dashboard-chat',
      approvedTaskIds: ['finance-payment-reminder-1'],
      requireConfirmation: true,
    }),
  });

  assert.equal(financeExecute.tasks[0].status, 'completed');
  assert.match(financeExecute.tasks[0].executionNote, /Payment reminder dispatched/i);

  const adminSession = await createDemoSession('admin@soulvest.demo', 'admin');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminSession.token}`,
  };

  const announcementExecute = await fetchJson(`${baseUrl}/agent-message`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      message: 'Draft an announcement about water shutdown on Saturday morning',
      user: adminSession.user,
      contextSnapshot: {
        payments: [],
        complaints: [],
        bookings: [],
        staffMembers: [],
        staffAttendance: [],
        visitors: [],
        announcements: [],
      },
      executionMode: 'execute',
      inputMode: 'text',
      channel: 'resident-dashboard-chat',
      approvedTaskIds: ['announcement-announcement-draft-1'],
      requireConfirmation: true,
    }),
  });

  assert.equal(announcementExecute.tasks[0].status, 'completed');
  assert.match(announcementExecute.tasks[0].executionNote, /Announcement draft created/i);
}

async function main() {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: port,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    const health = await waitForServer(child);
    await runPreviewFlow();

    if (health.firebaseConfigured) {
      await runExecuteFlows();
    } else {
      console.log('Skipping execute-mode smoke checks because Firebase is not configured.');
    }

    console.log('AI smoke tests passed.');
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error('AI smoke tests failed:', error.message);
  process.exitCode = 1;
});