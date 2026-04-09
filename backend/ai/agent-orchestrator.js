const { classifyIntents } = require('./intent-classifier');
const { buildMcpContext, createPromptContext } = require('./mcp-context');
const { hydrateAgentRequestContext } = require('./context-store');
const { generateConciergeReply } = require('./llm-client');
const { executeTaskPlan } = require('./task-executor');

const AGENT_PRIORITY = {
  visitor: 1,
  delivery: 2,
  staff: 3,
  finance: 4,
  complaint: 5,
  announcement: 6,
  booking: 7,
  marketplace: 8,
  concierge: 99,
};

function extractTimeReference(message) {
  return message.match(/\b(?:tomorrow|today|next week|\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\b/i)?.[0] || null;
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function extractFlatReference(message) {
  return message.match(/\b([A-Z]{1,2}-?\d{2,4})\b/i)?.[1]?.toUpperCase().replace(/\s+/g, '') || null;
}

function extractAmountReference(message) {
  const explicit = message.match(/(?:rs\.?|₹)\s*([\d,]+)/i)?.[1] || message.match(/\b(\d{3,6})\b/)?.[1] || null;
  return explicit ? Number(String(explicit).replace(/,/g, '')) : null;
}

function extractOtpReference(message) {
  return message.match(/\b(\d{4,8})\b/)?.[1] || null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function extractVisitorName(message, fallback = 'Visitor') {
  const patterns = [
    /(?:visitor|walk-?in|entry)\s+(?:for\s+)?([a-z][a-z\s'-]{1,40}?)(?:\s+(?:for|to|flat|at|coming|arriving)\b|$)/i,
    /for\s+([a-z][a-z\s'-]{1,40}?)(?:\s+(?:to|flat|at)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim();
    if (match && !/all residents|everyone/i.test(match)) {
      return match.replace(/\s+/g, ' ');
    }
  }

  return fallback;
}

function inferWalkInPurpose(message) {
  const text = normalizeText(message);
  if (/delivery|courier|parcel|amazon|swiggy|zomato|blinkit|zepto/.test(text)) return 'Delivery';
  if (/maid|cook|driver|staff|helper|nanny/.test(text)) return 'Staff visit';
  return 'Guest visit';
}

function inferChargeTitle(message) {
  if (/sinking fund/i.test(message)) return 'Quarterly Sinking Fund';
  if (/water/i.test(message)) return 'Water Charge';
  if (/maintenance/i.test(message)) return 'Monthly Maintenance';
  return 'Society Charge';
}

function inferMarketplaceCategory(message) {
  const text = String(message || '').toLowerCase();
  if (/sofa|table|chair|bed|mattress|wardrobe|desk|dining/.test(text)) return 'furniture';
  if (/fridge|refrigerator|washing machine|microwave|air fryer|ac|appliance/.test(text)) return 'appliance';
  if (/laptop|tablet|phone|tv|television|speaker|monitor|electronics?/.test(text)) return 'electronics';
  if (/bike|bicycle|scooter|car|vehicle/.test(text)) return 'vehicle';
  if (/stroller|crib|toy|kids|baby/.test(text)) return 'kids';
  return 'general';
}

function inferMarketplaceCondition(message) {
  const text = String(message || '').toLowerCase();
  if (/brand new|unused/.test(text)) return 'new';
  if (/like new/.test(text)) return 'like-new';
  if (/excellent/.test(text)) return 'excellent';
  if (/good/.test(text)) return 'good';
  if (/fair/.test(text)) return 'fair';
  if (/used|pre-?owned|second hand/.test(text)) return 'used';
  return 'good';
}

function inferMarketplaceTitle(message) {
  const patterns = [
    /(?:sell|selling|list|post|add|put up)\s+(?:my\s+)?(.+?)(?:\s+(?:for|at)\s+(?:rs\.?|₹)?\s*[\d,]+|$)/i,
    /(?:buy|buying|looking for|need)\s+(?:a|an|the\s+)?(.+?)(?:\s+(?:under|below)\s+(?:rs\.?|₹)?\s*[\d,]+|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim();
    if (match) {
      return match.replace(/\b(on|in)\s+the\s+market\s?place\b/i, '').replace(/\s+/g, ' ').trim();
    }
  }

  const category = inferMarketplaceCategory(message);
  if (category === 'furniture') return 'Furniture item';
  if (category === 'appliance') return 'Home appliance';
  if (category === 'electronics') return 'Electronic item';
  if (category === 'vehicle') return 'Vehicle listing';
  if (category === 'kids') return 'Kids item';
  return 'Marketplace listing';
}

function isMarketplaceCreateFlow(message) {
  return /\b(sell|selling|list|post|add|put up)\b/i.test(message);
}

function findMarketplaceMatches(message, listings = []) {
  const text = normalizeText(message);
  const category = inferMarketplaceCategory(message);

  return listings.filter((listing) => {
    if (String(listing.status || 'active').toLowerCase() !== 'active') {
      return false;
    }

    const haystack = normalizeText(`${listing.title || ''} ${listing.description || ''} ${listing.category || ''}`);
    if (haystack && text && haystack.includes(text)) {
      return true;
    }

    return category !== 'general' && normalizeText(listing.category) === category;
  });
}

function findResidentTargets(message, residents = []) {
  if (!residents.length) return [];

  if (/\b(all residents|everyone|all flats|every flat)\b/i.test(message)) {
    return residents;
  }

  const flat = extractFlatReference(message);
  if (flat) {
    const byFlat = residents.filter((resident) => normalizeText(resident.flat) === normalizeText(flat));
    if (byFlat.length) return byFlat;
  }

  return residents.filter((resident) => {
    const residentName = normalizeText(resident.name);
    return residentName && normalizeText(message).includes(residentName);
  });
}

function findComplaintMatch(message, complaints = []) {
  const text = normalizeText(message);
  const category = inferComplaintCategory(message);
  return complaints.find((complaint) => normalizeText(complaint.category) === category)
    || complaints.find((complaint) => normalizeText(complaint.flat) && text.includes(normalizeText(complaint.flat)))
    || complaints[0]
    || null;
}

function findVisitorMatch(message, visitors = []) {
  const text = normalizeText(message);
  return visitors.find((visitor) => normalizeText(visitor.name) && text.includes(normalizeText(visitor.name)))
    || visitors.find((visitor) => normalizeText(visitor.flat) && text.includes(normalizeText(visitor.flat)))
    || visitors[0]
    || null;
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

function isStaffIntentMessage(message) {
  return /\b(approve|allow|permit|let in|grant)\b/i.test(message);
}

function isStaffRelatedVisitor(visitor, staffSummary) {
  const source = `${visitor?.name || ''} ${visitor?.purpose || ''}`.toLowerCase();
  if (/maid|driver|cook|nanny|caretaker|cleaner|staff|helper/.test(source)) {
    return true;
  }

  return staffSummary.registeredNames.some((name) => name && source.includes(String(name).toLowerCase()));
}

function planVisitorTasks(message, mcpContext) {
  const visitorSummary = mcpContext.liveData.visitors;
  const actorRole = mcpContext.actor.role;

  if (actorRole === 'guard') {
    const otpCode = extractOtpReference(message);
    const approvedVisitor = findVisitorMatch(message, [...visitorSummary.approved, ...visitorSummary.preapproved]);
    const checkedInVisitor = findVisitorMatch(message, visitorSummary.checkedIn);

    if (/\b(verify|otp|qr|pass)\b/i.test(message) && otpCode) {
      return {
        agent: 'visitor',
        summary: `OTP ${otpCode} can be verified at the gate after confirmation.`,
        tasks: attachTaskMetadata('visitor', [
          {
            type: 'visitor-verify-pass',
            title: `Verify pass ${otpCode}`,
            payload: {
              code: otpCode,
              societyId: mcpContext.actor.societyId,
            },
          },
        ]),
      };
    }

    if (/\b(check\s?out|checkout|exit)\b/i.test(message) && checkedInVisitor) {
      return {
        agent: 'visitor',
        summary: `${checkedInVisitor.name} can be checked out from the gate log after confirmation.`,
        tasks: attachTaskMetadata('visitor', [
          {
            type: 'visitor-check-out',
            title: `Check out ${checkedInVisitor.name}`,
            payload: {
              visitorId: checkedInVisitor.id,
              visitorName: checkedInVisitor.name,
              societyId: mcpContext.actor.societyId,
            },
          },
        ]),
      };
    }

    if (/\b(check\s?in|checkin|allow\s+entry|let\s+in|allow\s+in)\b/i.test(message) && approvedVisitor) {
      return {
        agent: 'visitor',
        summary: `${approvedVisitor.name} is ready for gate check-in after confirmation.`,
        tasks: attachTaskMetadata('visitor', [
          {
            type: 'visitor-check-in',
            title: `Check in ${approvedVisitor.name}`,
            payload: {
              visitorId: approvedVisitor.id,
              visitorName: approvedVisitor.name,
              societyId: mcpContext.actor.societyId,
            },
          },
        ]),
      };
    }

    if (/\b(log|add|create)\b.*\b(visitor|walk-?in|entry)\b/i.test(message)) {
      const flat = extractFlatReference(message);
      const visitorName = extractVisitorName(message, 'Walk-in visitor');
      return {
        agent: 'visitor',
        summary: `${visitorName} can be logged as a walk-in visitor${flat ? ` for Flat ${flat}` : ''} after confirmation.`,
        tasks: attachTaskMetadata('visitor', [
          {
            type: 'visitor-create',
            title: `Log walk-in visitor ${visitorName}`,
            payload: {
              visitorName,
              flat,
              purpose: inferWalkInPurpose(message),
              time: extractTimeReference(message) || nowIso(),
              societyId: mcpContext.actor.societyId,
            },
          },
        ]),
      };
    }

    return {
      agent: 'visitor',
      summary: `Gate status shows ${visitorSummary.preapprovedCount} pre-approved, ${visitorSummary.approvedCount} approved, and ${visitorSummary.checkedInCount} checked-in visitors.`,
      tasks: [],
    };
  }

  const namedMatch = message.match(/approve\s+([a-z][a-z\s'-]{1,30})/i);
  const requestedName = namedMatch?.[1]?.trim() || null;
  const requestedStatus = /\b(deny|denied|reject)\b/i.test(message) ? 'denied' : 'approved';
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
    summary: `${visitorName} can be marked ${requestedStatus}${validUntil ? ` with a ${validUntil} reference` : ''}.`,
    tasks: attachTaskMetadata('visitor', [
      {
        type: 'visitor-status-update',
        title: `${requestedStatus === 'approved' ? 'Approve' : 'Deny'} visitor ${visitorName}`,
        payload: {
          visitorId: matchedVisitor?.id || null,
          visitorName,
          status: requestedStatus,
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
  const incidentReported = /damaged|missing|wrong|spilled|broken|issue|complaint/i.test(message);

  return {
    agent: 'delivery',
    summary: latestDelivery
      ? `The latest delivery from ${latestDelivery.name} can be routed to ${route}.${incidentReported ? ' The complaint agent should also review the delivery issue.' : ''}`
      : `Delivery routing is set to ${route} once a matching package request is available.`,
    tasks: attachTaskMetadata('delivery', [
      {
        type: 'delivery-routing-preview',
        title: `Route delivery to ${route}`,
        payload: {
          visitorId: latestDelivery?.id || null,
          route,
          incidentReported,
          societyId: mcpContext.actor.societyId,
        },
      },
    ]),
  };
}

function planFinanceTasks(message, request, mcpContext) {
  const payments = mcpContext.liveData.payments;
  const reminderWhen = extractTimeReference(message) || (message.toLowerCase().includes('tomorrow') ? 'tomorrow' : null);
  const residents = Array.isArray(request.contextSnapshot?.residents) ? request.contextSnapshot.residents : [];

  if (mcpContext.actor.role === 'admin' && /\b(charge|bill|invoice|maintenance)\b/i.test(message)) {
    const amount = extractAmountReference(message) || 3500;
    const targetResidents = findResidentTargets(message, residents);

    if (!targetResidents.length) {
      return {
        agent: 'finance',
        summary: 'I could not match any resident targets for that charge request. Mention a flat, resident name, or say all residents.',
        tasks: [],
      };
    }

    return {
      agent: 'finance',
      summary: `${inferChargeTitle(message)} of ${formatCurrency(amount)} can be created for ${targetResidents.length} resident${targetResidents.length === 1 ? '' : 's'}.`,
      tasks: attachTaskMetadata('finance', [
        {
          type: 'payment-create-charge',
          title: `Create ${inferChargeTitle(message)} charge`,
          payload: {
            title: inferChargeTitle(message),
            amount,
            dueDate: reminderWhen,
            societyId: mcpContext.actor.societyId,
            targetResidents: targetResidents.map((resident) => ({
              id: resident.id || resident.uid,
              name: resident.name,
              flat: resident.flat,
            })),
          },
        },
      ]),
    };
  }

  return {
    agent: 'finance',
    summary: payments.pendingCount
      ? `There are ${payments.pendingCount} pending due${payments.pendingCount === 1 ? '' : 's'} totaling ${formatCurrency(payments.totalPending)}.${reminderWhen ? ` A reminder can be scheduled for ${reminderWhen}.` : ''}`
      : 'There are no pending dues right now.',
    tasks: reminderWhen
      ? attachTaskMetadata('finance', [
          {
            type: 'payment-reminder',
            title: `Schedule dues reminder for ${reminderWhen}`,
            payload: {
              remindAt: reminderWhen,
              userId: mcpContext.actor.uid,
              societyId: mcpContext.actor.societyId,
            },
          },
        ])
      : [],
  };
}

function planComplaintTasks(message, mcpContext) {
  const complaints = mcpContext.liveData.complaints;
  const isCreateFlow = /\b(report|raise|file|log)\b/i.test(message);
  const isResolveFlow = mcpContext.actor.role === 'admin' && /\b(resolve|resolved|close|closed|mark\s+resolved)\b/i.test(message);

  if (isResolveFlow) {
    const targetComplaint = findComplaintMatch(message, complaints.latest);

    if (!targetComplaint) {
      return {
        agent: 'complaint',
        summary: 'There is no open complaint available to resolve right now.',
        tasks: [],
      };
    }

    return {
      agent: 'complaint',
      summary: `${targetComplaint.category} complaint for Flat ${targetComplaint.flat || 'unknown'} can be marked resolved after confirmation.`,
      tasks: attachTaskMetadata('complaint', [
        {
          type: 'complaint-status-update',
          title: `Resolve ${targetComplaint.category} complaint`,
          payload: {
            complaintId: targetComplaint.id,
            status: 'resolved',
            resolutionNote: 'Resolved by AI assistant request.',
            societyId: mcpContext.actor.societyId,
          },
        },
      ]),
    };
  }

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

function planStaffTasks(message, mcpContext) {
  const staff = mcpContext.liveData.staff;
  const pendingStaffVisitor = mcpContext.liveData.visitors.pending.find((visitor) => isStaffRelatedVisitor(visitor, staff)) || null;
  const shouldApprove = isStaffIntentMessage(message) && pendingStaffVisitor;

  return {
    agent: 'staff',
    summary: shouldApprove
      ? `${pendingStaffVisitor.name} looks like a staff access request and can be approved after confirmation.`
      : staff.alerts.length
        ? staff.alerts[0].alertMessage || `${staff.presentCount} staff members are present with an alert to review.`
        : `${staff.presentCount} staff member${staff.presentCount === 1 ? '' : 's'} are currently present. ${staff.registeredCount} staff profiles are registered.`,
    tasks: shouldApprove
      ? attachTaskMetadata('staff', [
          {
            type: 'visitor-status-update',
            title: `Approve staff entry for ${pendingStaffVisitor.name}`,
            payload: {
              visitorId: pendingStaffVisitor.id,
              visitorName: pendingStaffVisitor.name,
              status: 'approved',
              residentId: pendingStaffVisitor.residentId || mcpContext.actor.uid || null,
              flat: pendingStaffVisitor.flat || mcpContext.actor.flat || null,
              societyId: mcpContext.actor.societyId,
            },
          },
        ])
      : [],
  };
}

function planAnnouncementTasks(message, mcpContext) {
  const draftTopic = message.replace(/.*?(announcement|announce|notice)/i, '').trim();
  return {
    agent: 'announcement',
    summary: 'An admin announcement draft can be prepared from this request.',
    tasks: attachTaskMetadata('announcement', [
      {
        type: 'announcement-draft',
        title: 'Draft society announcement',
        payload: {
          topic: draftTopic || message,
          language: mcpContext.actor.language,
          societyId: mcpContext.actor.societyId,
        },
      },
    ]),
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

function planMarketplaceTasks(message, mcpContext) {
  const marketplace = mcpContext.liveData.marketplace;
  const matchingListings = findMarketplaceMatches(message, marketplace.latest);
  const isCreateFlow = isMarketplaceCreateFlow(message);

  if (isCreateFlow) {
    if (!['resident', 'admin'].includes(mcpContext.actor.role)) {
      return {
        agent: 'marketplace',
        summary: 'Marketplace posting is available for residents and admins only.',
        tasks: [],
      };
    }

    const title = inferMarketplaceTitle(message);
    const price = extractAmountReference(message);

    return {
      agent: 'marketplace',
      summary: `${title} can be posted to the society marketplace${price ? ` for ${formatCurrency(price)}` : ''} after confirmation.`,
      tasks: attachTaskMetadata('marketplace', [
        {
          type: 'marketplace-listing-create',
          title: `Create marketplace listing for ${title}`,
          payload: {
            title,
            description: message,
            category: inferMarketplaceCategory(message),
            condition: inferMarketplaceCondition(message),
            price,
            listingType: 'sell',
            residentId: mcpContext.actor.uid,
            residentName: mcpContext.actor.name,
            flat: mcpContext.actor.flat,
            societyId: mcpContext.actor.societyId,
            language: mcpContext.actor.language,
          },
        },
      ]),
    };
  }

  if (matchingListings.length) {
    const listingSummary = matchingListings
      .slice(0, 2)
      .map((listing) => `${listing.title}${listing.price ? ` for ${formatCurrency(listing.price)}` : ''}`)
      .join(' and ');

    return {
      agent: 'marketplace',
      summary: `${matchingListings.length} marketplace listing${matchingListings.length === 1 ? '' : 's'} match this request, including ${listingSummary}.`,
      tasks: [],
    };
  }

  return {
    agent: 'marketplace',
    summary: marketplace.activeCount
      ? `There are ${marketplace.activeCount} active marketplace listing${marketplace.activeCount === 1 ? '' : 's'} in the community right now.`
      : 'There are no active marketplace listings right now.',
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

function prioritizeAgents(agents) {
  return [...agents].sort((left, right) => (AGENT_PRIORITY[left] || 50) - (AGENT_PRIORITY[right] || 50));
}

function buildDecisionTrail(agentPlans) {
  return agentPlans.map((plan, index) => ({
    step: index + 1,
    agent: plan.agent,
    summary: plan.summary,
    taskCount: plan.tasks.length,
    taskTypes: plan.tasks.map((task) => task.type),
  }));
}

function upsertById(items, nextItem) {
  if (!nextItem?.id) {
    return items;
  }

  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [nextItem, ...items];
  }

  const updated = [...items];
  updated[index] = {
    ...updated[index],
    ...nextItem,
  };
  return updated;
}

function applyExecutedTasksToSnapshot(request, executedTasks, actor) {
  const contextSnapshot = {
    ...(request.contextSnapshot || {}),
    payments: Array.isArray(request.contextSnapshot?.payments) ? [...request.contextSnapshot.payments] : [],
    complaints: Array.isArray(request.contextSnapshot?.complaints) ? [...request.contextSnapshot.complaints] : [],
    bookings: Array.isArray(request.contextSnapshot?.bookings) ? [...request.contextSnapshot.bookings] : [],
    staffMembers: Array.isArray(request.contextSnapshot?.staffMembers) ? [...request.contextSnapshot.staffMembers] : [],
    staffAttendance: Array.isArray(request.contextSnapshot?.staffAttendance) ? [...request.contextSnapshot.staffAttendance] : [],
    visitors: Array.isArray(request.contextSnapshot?.visitors) ? [...request.contextSnapshot.visitors] : [],
    announcements: Array.isArray(request.contextSnapshot?.announcements) ? [...request.contextSnapshot.announcements] : [],
    marketplaceListings: Array.isArray(request.contextSnapshot?.marketplaceListings) ? [...request.contextSnapshot.marketplaceListings] : [],
  };

  for (const task of executedTasks) {
    if (task.status !== 'completed') {
      continue;
    }

    if (task.type === 'delivery-routing-preview' || task.type === 'visitor-status-update') {
      const visitorId = task.payload?.visitorId;
      if (!visitorId) continue;

      const existingVisitor = contextSnapshot.visitors.find((visitor) => visitor.id === visitorId) || {};
      const nextStatus = task.type === 'delivery-routing-preview'
        ? 'approved'
        : (task.payload?.status || existingVisitor.status || 'approved');
      contextSnapshot.visitors = upsertById(contextSnapshot.visitors, {
        ...existingVisitor,
        id: visitorId,
        residentId: task.payload?.residentId || existingVisitor.residentId || actor.uid || null,
        flat: task.payload?.flat || existingVisitor.flat || actor.flat || null,
        societyId: task.payload?.societyId || existingVisitor.societyId || actor.societyId || null,
        name: task.payload?.visitorName || existingVisitor.name,
        status: nextStatus,
        deliveryStatus: task.payload?.deliveryStatus || existingVisitor.deliveryStatus,
        routedAt: task.payload?.routedAt || existingVisitor.routedAt,
        updatedAt: task.payload?.routedAt || existingVisitor.updatedAt || new Date().toISOString(),
      });
      continue;
    }

    if (task.type === 'visitor-create') {
      contextSnapshot.visitors = upsertById(contextSnapshot.visitors, {
        id: task.payload?.visitorId,
        name: task.payload?.visitorName,
        purpose: task.payload?.purpose || 'Guest visit',
        flat: task.payload?.flat || null,
        residentId: task.payload?.residentId || null,
        residentName: task.payload?.residentName || '',
        societyId: task.payload?.societyId || actor.societyId || null,
        status: 'pending',
        time: task.payload?.time || nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      continue;
    }

    if (task.type === 'visitor-verify-pass' || task.type === 'visitor-check-in' || task.type === 'visitor-check-out') {
      const visitorId = task.payload?.visitorId;
      if (!visitorId) continue;

      const existingVisitor = contextSnapshot.visitors.find((visitor) => visitor.id === visitorId) || {};
      contextSnapshot.visitors = upsertById(contextSnapshot.visitors, {
        ...existingVisitor,
        id: visitorId,
        name: task.payload?.visitorName || existingVisitor.name,
        societyId: task.payload?.societyId || existingVisitor.societyId || actor.societyId || null,
        status: task.payload?.status || existingVisitor.status,
        checkedInAt: task.payload?.status === 'checked_in' ? nowIso() : existingVisitor.checkedInAt,
        exitTime: task.payload?.status === 'checked_out' ? nowIso() : existingVisitor.exitTime,
        updatedAt: nowIso(),
      });
      continue;
    }

    if (task.type === 'complaint-create') {
      contextSnapshot.complaints = upsertById(contextSnapshot.complaints, {
        id: task.payload?.complaintId,
        category: task.payload?.category,
        description: task.payload?.description,
        residentId: task.payload?.residentId || actor.uid || null,
        residentName: task.payload?.residentName || actor.name || 'Resident',
        flat: task.payload?.flat || actor.flat || null,
        societyId: task.payload?.societyId || actor.societyId || null,
        status: 'open',
        aiPriority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    if (task.type === 'complaint-status-update') {
      const complaintId = task.payload?.complaintId;
      if (!complaintId) continue;

      const existingComplaint = contextSnapshot.complaints.find((complaint) => complaint.id === complaintId) || {};
      contextSnapshot.complaints = upsertById(contextSnapshot.complaints, {
        ...existingComplaint,
        id: complaintId,
        status: task.payload?.status || existingComplaint.status || 'resolved',
        resolutionNote: task.payload?.resolutionNote || existingComplaint.resolutionNote || '',
        updatedAt: nowIso(),
      });
      continue;
    }

    if (task.type === 'payment-create-charge') {
      const targets = Array.isArray(task.payload?.targetResidents) ? task.payload.targetResidents : [];
      contextSnapshot.payments = [
        ...targets.map((resident) => ({
          id: `${task.id}-${resident.id}`,
          userId: resident.id,
          residentName: resident.name,
          flat: resident.flat,
          societyId: task.payload?.societyId || actor.societyId || null,
          title: task.payload?.title || 'Society Charge',
          amount: Number(task.payload?.amount || 0),
          dueDate: task.payload?.dueDate || nowIso(),
          status: 'pending',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })),
        ...contextSnapshot.payments,
      ];
      continue;
    }

    if (task.type === 'announcement-draft') {
      contextSnapshot.announcements = upsertById(contextSnapshot.announcements, {
        id: task.payload?.announcementId,
        title: task.payload?.topic ? `Draft: ${String(task.payload.topic).trim().slice(0, 72)}` : 'Draft: Society announcement',
        body: task.payload?.topic || 'AI-generated draft announcement. Review before publishing.',
        language: task.payload?.language || actor.language || 'en',
        pinned: false,
        audience: 'all',
        acknowledgements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAgent: true,
        publishState: 'draft',
        taskId: task.id,
      });
      continue;
    }

    if (task.type === 'marketplace-listing-create') {
      contextSnapshot.marketplaceListings = upsertById(contextSnapshot.marketplaceListings, {
        id: task.payload?.listingId,
        title: task.payload?.title || 'Marketplace listing',
        description: task.payload?.description || '',
        category: task.payload?.category || 'general',
        condition: task.payload?.condition || 'good',
        listingType: task.payload?.listingType || 'sell',
        price: Number(task.payload?.price || 0) || null,
        residentId: task.payload?.residentId || actor.uid || null,
        residentName: task.payload?.residentName || actor.name || 'Resident',
        flat: task.payload?.flat || actor.flat || null,
        societyId: task.payload?.societyId || actor.societyId || null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByAgent: true,
      });
    }
  }

  return {
    ...request,
    contextSnapshot,
  };
}

function buildFallbackReply(agentPlans, executedTasks) {
  const summary = agentPlans.map((plan) => plan.summary).filter(Boolean).join(' ');
  if (!executedTasks.length) {
    return summary || 'I reviewed your request and prepared the relevant agent context.';
  }

  return `${summary} ${summarizeTasks(executedTasks)}`.trim();
}

function buildCollaborationPlans(agentPlans) {
  const byAgent = new Map(agentPlans.map((plan) => [plan.agent, plan]));
  const collaborationPlans = [];

  const deliveryPlan = byAgent.get('delivery');
  const complaintPlan = byAgent.get('complaint');
  if (deliveryPlan && complaintPlan) {
    const deliveryTask = deliveryPlan.tasks[0] || null;
    const complaintTask = complaintPlan.tasks[0] || null;

    if (deliveryTask?.payload && complaintTask?.payload) {
      complaintTask.payload.relatedDeliveryVisitorId = deliveryTask.payload.visitorId || null;
      complaintTask.payload.relatedRoute = deliveryTask.payload.route || null;
    }

    collaborationPlans.push({
      id: 'delivery-complaint-handoff',
      title: 'Delivery to Complaint handoff',
      agents: ['delivery', 'complaint'],
      summary: 'Route the package safely first, then include the delivery reference in the complaint record.',
    });
  }

  const staffPlan = byAgent.get('staff');
  const visitorPlan = byAgent.get('visitor');
  if (staffPlan && visitorPlan) {
    collaborationPlans.push({
      id: 'staff-visitor-alignment',
      title: 'Staff access alignment',
      agents: ['staff', 'visitor'],
      summary: 'Use resident visitor controls to complete staff entry approvals when the gate event matches a registered worker.',
    });
  }

  return collaborationPlans;
}

async function orchestrateAgentMessage(request, dependencies) {
  const hydratedRequest = await hydrateAgentRequestContext(request, dependencies);
  const intents = classifyIntents(request.message);
  const orderedAgents = prioritizeAgents([...new Set(intents.map((intent) => intent.agent))]);
  const routing = {
    intents: intents.map((intent) => intent.id),
    agents: orderedAgents,
  };

  const initialMcpContext = buildMcpContext(hydratedRequest);

  const agentPlans = routing.agents.map((agent) => {
    switch (agent) {
      case 'visitor':
        return planVisitorTasks(hydratedRequest.message, initialMcpContext);
      case 'delivery':
        return planDeliveryTasks(hydratedRequest.message, initialMcpContext);
      case 'finance':
        return planFinanceTasks(hydratedRequest.message, hydratedRequest, initialMcpContext);
      case 'complaint':
        return planComplaintTasks(hydratedRequest.message, initialMcpContext);
      case 'staff':
        return planStaffTasks(hydratedRequest.message, initialMcpContext);
      case 'announcement':
        return planAnnouncementTasks(hydratedRequest.message, initialMcpContext);
      case 'booking':
        return planBookingTasks(initialMcpContext);
      case 'marketplace':
        return planMarketplaceTasks(hydratedRequest.message, initialMcpContext);
      default:
        return planConciergeSummary(initialMcpContext);
    }
  });

  const collaborationPlans = buildCollaborationPlans(agentPlans);
  const plannedTasks = agentPlans.flatMap((plan) => plan.tasks);
  const executedTasks = await executeTaskPlan(plannedTasks, {
    executionMode: hydratedRequest.executionMode,
    approvedTaskIds: hydratedRequest.approvedTaskIds,
    requireConfirmation: hydratedRequest.requireConfirmation,
    auth: hydratedRequest.auth,
    actor: initialMcpContext.actor,
  }, dependencies);
  const postExecutionRequest = applyExecutedTasksToSnapshot(hydratedRequest, executedTasks, initialMcpContext.actor);
  const mcpContext = buildMcpContext(postExecutionRequest);
  const promptContext = createPromptContext(mcpContext, routing, collaborationPlans);
  const decisionTrail = buildDecisionTrail(agentPlans);

  let reply = '';
  let llm = { provider: 'none', model: null };
  try {
    const llmResponse = await generateConciergeReply({
      promptContext,
      agentSummaries: [
        ...agentPlans.map((plan) => `${plan.agent}: ${plan.summary}`),
        ...collaborationPlans.map((plan) => `collaboration: ${plan.summary}`),
      ],
      userMessage: hydratedRequest.message,
      language: mcpContext.actor.language,
    });
    reply = llmResponse?.text || '';
    llm = {
      provider: llmResponse?.provider || 'none',
      model: llmResponse?.model || null,
      promptVersion: llmResponse?.promptVersion || 'concierge-v2',
    };
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
    collaborationPlans,
    decisionTrail,
    llm,
    mcpContext,
  };
}

module.exports = {
  orchestrateAgentMessage,
};