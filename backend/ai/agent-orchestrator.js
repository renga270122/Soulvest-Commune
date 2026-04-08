const { classifyIntents } = require('./intent-classifier');
const { buildMcpContext, createPromptContext } = require('./mcp-context');
const { generateConciergeReply } = require('./llm-client');
const { executeTaskPlan } = require('./task-executor');

function extractTimeReference(message) {
  return message.match(/\b(?:tomorrow|today|next week|\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\b/i)?.[0] || null;
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function inferComplaintCategory(message) {
  const text = String(message || '').toLowerCase();
  if (/plumb|water|leak|pipe|tap/.test(text)) return 'plumbing';
  if (/electric|power|light|sparking|socket/.test(text)) return 'electrical';
  if (/lift|elevator/.test(text)) return 'lift';
  if (/security|guard|gate/.test(text)) return 'security';
  if (/clean|garbage|housekeeping/.test(text)) return 'housekeeping';
  if (/delivery|parcel|courier/.test(text)) return 'delivery';
  if (/maid|cook|driver|staff/.test(text)) return 'staff-access';
  return 'general';
}

function attachTaskMetadata(agent, tasks) {
  return tasks.map((task, index) => ({
    id: `${agent}-${task.type}-${index + 1}`,
    requiresConfirmation: true,
    ...task,
  }));
}

function planVisitorTasks(message, mcpContext) {
  const visitorSummary = mcpContext.liveData.visitors;
  const namedMatch = message.match(/approve\s+([a-z][a-z\s'-]{1,30})/i);
  const requestedName = namedMatch?.[1]?.trim() || null;
  const matchedVisitor = visitorSummary.pending.find((visitor) => {
    if (!requestedName) return false;
    return visitor.name?.toLowerCase().includes(requestedName.toLowerCase());
  }) || visitorSummary.pending[0] || null;
  const validUntil = extractTimeReference(message);

  if (!matchedVisitor && !requestedName) {
    return {
      agent: 'visitor',
      summary: 'No pending visitor matched this request, so the agent prepared a preview only.',
      tasks: [],
    };
  }

  const visitorName = matchedVisitor?.name || requestedName || 'the visitor';
  return {
    agent: 'visitor',
    summary: `${visitorName} can be approved for entry${validUntil ? ` with a ${validUntil} reference` : ''}.`,
    tasks: attachTaskMetadata('visitor', [
      {
        type: 'visitor-status-update',
        title: `Approve visitor ${visitorName}`,
        payload: {
          visitorId: matchedVisitor?.id || null,
          visitorName,
          status: 'approved',
          validUntil,
          residentId: matchedVisitor?.residentId || mcpContext.actor.uid || null,
          flat: matchedVisitor?.flat || mcpContext.actor.flat || null,
          societyId: mcpContext.actor.societyId,
        },
      },
    ]),
  };
}

function planDeliveryTasks(message, mcpContext) {
  const deliveries = mcpContext.liveData.visitors.deliveries;
  const route = /doorstep/i.test(message) ? 'doorstep' : /security|gate|hold/i.test(message) ? 'security' : 'review';
  const latestDelivery = deliveries[0] || null;

  return {
    agent: 'delivery',
    summary: latestDelivery
      ? `The latest delivery from ${latestDelivery.name} can be routed to ${route}.`
      : `Delivery routing is set to ${route} once a matching package request is available.`,
    tasks: [
      {
        type: 'delivery-routing-preview',
        title: `Route delivery to ${route}`,
        payload: {
          visitorId: latestDelivery?.id || null,
          route,
          societyId: mcpContext.actor.societyId,
        },
      },
    ],
  };
}

function planFinanceTasks(message, mcpContext) {
  const payments = mcpContext.liveData.payments;
  const reminderWhen = extractTimeReference(message) || (message.toLowerCase().includes('tomorrow') ? 'tomorrow' : null);

  return {
    agent: 'finance',
    summary: payments.pendingCount
      ? `There are ${payments.pendingCount} pending due${payments.pendingCount === 1 ? '' : 's'} totaling ${formatCurrency(payments.totalPending)}.${reminderWhen ? ` A reminder can be scheduled for ${reminderWhen}.` : ''}`
      : 'There are no pending dues right now.',
    tasks: reminderWhen
      ? [
          {
            type: 'payment-reminder',
            title: `Schedule dues reminder for ${reminderWhen}`,
            payload: {
              remindAt: reminderWhen,
              userId: mcpContext.actor.uid,
              societyId: mcpContext.actor.societyId,
            },
          },
        ]
      : [],
  };
}

function planComplaintTasks(message, mcpContext) {
  const complaints = mcpContext.liveData.complaints;
  const isCreateFlow = /\b(report|raise|file|log)\b/i.test(message);

  return {
    agent: 'complaint',
    summary: isCreateFlow
      ? 'A complaint can be created from this message after confirmation.'
      : complaints.openCount
        ? `There are ${complaints.openCount} open complaint${complaints.openCount === 1 ? '' : 's'} in progress.`
        : 'There are no open complaints right now.',
    tasks: isCreateFlow
      ? attachTaskMetadata('complaint', [
          {
            type: 'complaint-create',
            title: 'Create complaint',
            payload: {
              category: inferComplaintCategory(message),
              description: message,
              residentId: mcpContext.actor.uid,
              residentName: mcpContext.actor.name,
              flat: mcpContext.actor.flat,
              language: mcpContext.actor.language,
              societyId: mcpContext.actor.societyId,
            },
          },
        ])
      : [],
  };
}

function planStaffTasks(mcpContext) {
  const staff = mcpContext.liveData.staff;
  return {
    agent: 'staff',
    summary: staff.alerts.length
      ? staff.alerts[0].alertMessage || `${staff.presentCount} staff members are present with an alert to review.`
      : `${staff.presentCount} staff member${staff.presentCount === 1 ? '' : 's'} are currently present.`,
    tasks: [],
  };
}

function planAnnouncementTasks(message, mcpContext) {
  const draftTopic = message.replace(/.*?(announcement|announce|notice)/i, '').trim();
  return {
    agent: 'announcement',
    summary: 'An admin announcement draft can be prepared from this request.',
    tasks: [
      {
        type: 'announcement-draft',
        title: 'Draft society announcement',
        payload: {
          topic: draftTopic || message,
          language: mcpContext.actor.language,
          societyId: mcpContext.actor.societyId,
        },
      },
    ],
  };
}

function planBookingTasks(mcpContext) {
  const nextBooking = mcpContext.liveData.bookings.next;
  return {
    agent: 'booking',
    summary: nextBooking
      ? `The next active booking is ${nextBooking.amenity} on ${nextBooking.bookingDate}.`
      : 'There are no active amenity bookings right now.',
    tasks: [],
  };
}

function planConciergeSummary(mcpContext) {
  const payments = mcpContext.liveData.payments.pendingCount;
  const complaints = mcpContext.liveData.complaints.openCount;
  return {
    agent: 'concierge',
    summary: `Resident context loaded with ${payments} pending dues and ${complaints} open complaints.`,
    tasks: [],
  };
}

function summarizeTasks(tasks) {
  if (!tasks.length) {
    return 'No follow-up tasks were needed.';
  }

  return tasks.map((task) => `- ${task.title} (${task.status})`).join('\n');
}

function buildFallbackReply(agentPlans, executedTasks) {
  const summary = agentPlans.map((plan) => plan.summary).filter(Boolean).join(' ');
  if (!executedTasks.length) {
    return summary || 'I reviewed your request and prepared the relevant agent context.';
  }

  return `${summary} ${summarizeTasks(executedTasks)}`.trim();
}

async function orchestrateAgentMessage(request, dependencies) {
  const intents = classifyIntents(request.message);
  const routing = {
    intents: intents.map((intent) => intent.id),
    agents: [...new Set(intents.map((intent) => intent.agent))],
  };

  const mcpContext = buildMcpContext(request);

  const agentPlans = routing.agents.map((agent) => {
    switch (agent) {
      case 'visitor':
        return planVisitorTasks(request.message, mcpContext);
      case 'delivery':
        return planDeliveryTasks(request.message, mcpContext);
      case 'finance':
        return planFinanceTasks(request.message, mcpContext);
      case 'complaint':
        return planComplaintTasks(request.message, mcpContext);
      case 'staff':
        return planStaffTasks(mcpContext);
      case 'announcement':
        return planAnnouncementTasks(request.message, mcpContext);
      case 'booking':
        return planBookingTasks(mcpContext);
      default:
        return planConciergeSummary(mcpContext);
    }
  });

  const plannedTasks = agentPlans.flatMap((plan) => plan.tasks);
  const executedTasks = await executeTaskPlan(plannedTasks, {
    executionMode: request.executionMode,
    approvedTaskIds: request.approvedTaskIds,
    requireConfirmation: request.requireConfirmation,
    actor: mcpContext.actor,
  }, dependencies);
  const promptContext = createPromptContext(mcpContext, routing);

  let reply = '';
  try {
    reply = await generateConciergeReply({
      promptContext,
      agentSummaries: agentPlans.map((plan) => `${plan.agent}: ${plan.summary}`),
      userMessage: request.message,
      language: mcpContext.actor.language,
    });
  } catch {
    reply = '';
  }

  if (!reply) {
    reply = buildFallbackReply(agentPlans, executedTasks);
  }

  return {
    reply,
    routing,
    tasks: executedTasks,
    agentPlans: agentPlans.map((plan) => ({ agent: plan.agent, summary: plan.summary })),
    mcpContext,
  };
}

module.exports = {
  orchestrateAgentMessage,
};