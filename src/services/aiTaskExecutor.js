import {
  checkInVisitor,
  checkOutVisitor,
  createAnnouncement,
  createComplaint,
  createMarketplaceListing,
  createPaymentRecord,
  createVisitor,
  routeDelivery,
  updateComplaintStatus,
  updateVisitorStatus,
  verifyVisitorPass,
} from './communityData';

function cloneTask(task, overrides = {}) {
  return {
    ...task,
    payload: {
      ...(task?.payload || {}),
      ...(overrides.payload || {}),
    },
    ...overrides,
  };
}

export async function executeLocalAiTask(task, actor, contextSnapshot = {}) {
  if (!task?.type) {
    return { tasks: [] };
  }

  if (task.type === 'visitor-status-update') {
    await updateVisitorStatus(task.payload?.visitorId, task.payload?.status, actor);
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${task.payload?.visitorName || 'Visitor'} was marked ${task.payload?.status}.`,
      })],
    };
  }

  if (task.type === 'delivery-routing-preview') {
    const updated = await routeDelivery(task.payload?.visitorId, task.payload?.route, actor);
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${updated.vendorName || updated.name || 'Delivery'} routed to ${task.payload?.route}.`,
        payload: {
          deliveryStatus: updated.deliveryStatus,
        },
      })],
    };
  }

  if (task.type === 'complaint-create') {
    const created = await createComplaint({
      category: task.payload?.category,
      description: task.payload?.description,
      residentId: task.payload?.residentId || actor?.uid,
      residentName: task.payload?.residentName || actor?.name || 'Resident',
      flat: task.payload?.flat || actor?.flat || '',
      societyId: task.payload?.societyId || actor?.societyId,
    });

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `Complaint created with id ${created.id}.`,
        payload: {
          complaintId: created.id,
        },
      })],
    };
  }

  if (task.type === 'announcement-draft') {
    await createAnnouncement({
      title: task.payload?.topic ? `Draft: ${String(task.payload.topic).trim().slice(0, 72)}` : 'Draft: Society announcement',
      body: task.payload?.topic || 'AI-generated draft announcement. Review before publishing.',
      language: task.payload?.language || actor?.language || 'en',
      pinned: false,
      audience: 'all',
      postedBy: { uid: actor?.uid || '', name: actor?.name || 'Admin' },
      societyId: task.payload?.societyId || actor?.societyId,
    });

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: 'Announcement draft created in demo mode.',
      })],
    };
  }

  if (task.type === 'payment-create-charge') {
    const targets = Array.isArray(task.payload?.targetResidents)
      ? task.payload.targetResidents
      : Array.isArray(contextSnapshot?.residents)
        ? contextSnapshot.residents
        : [];

    await Promise.all(targets.map((resident) => createPaymentRecord({
      userId: resident.id || resident.uid,
      residentName: resident.name || 'Resident',
      flat: resident.flat || '',
      societyId: task.payload?.societyId || actor?.societyId,
      title: task.payload?.title || 'Society Charge',
      dueDate: task.payload?.dueDate || new Date().toISOString(),
      amount: Number(task.payload?.amount || 0),
      breakdown: task.payload?.breakdown || {
        Security: 40,
        Housekeeping: 25,
        Utilities: 20,
        Other: 15,
      },
      status: 'pending',
      method: 'manual',
    })));

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `Charge created for ${targets.length} resident${targets.length === 1 ? '' : 's'}.`,
      })],
    };
  }

  if (task.type === 'complaint-status-update') {
    await updateComplaintStatus(task.payload?.complaintId, task.payload?.status || 'resolved', actor, {
      resolutionNote: task.payload?.resolutionNote || 'Resolved by AI assistant request.',
    });

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `Complaint ${task.payload?.complaintId} was marked ${task.payload?.status || 'resolved'}.`,
      })],
    };
  }

  if (task.type === 'visitor-create') {
    await createVisitor({
      name: task.payload?.visitorName || 'Walk-in visitor',
      flat: task.payload?.flat || '',
      purpose: task.payload?.purpose || 'Guest visit',
      time: task.payload?.time || new Date().toISOString(),
      societyId: task.payload?.societyId || actor?.societyId,
      loggedByName: actor?.name || 'Guard',
      loggedByUid: actor?.uid || '',
      residentId: task.payload?.residentId || '',
      residentName: task.payload?.residentName || '',
      phone: task.payload?.phone || '',
    });

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${task.payload?.visitorName || 'Visitor'} was logged successfully.`,
      })],
    };
  }

  if (task.type === 'visitor-verify-pass') {
    const verified = await verifyVisitorPass(task.payload?.code, actor);
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${verified.name || verified.visitorName || 'Visitor'} checked in successfully.`,
        payload: {
          visitorId: verified.id,
          visitorName: verified.name || verified.visitorName,
          status: 'checked_in',
        },
      })],
    };
  }

  if (task.type === 'visitor-check-in') {
    await checkInVisitor(task.payload?.visitorId, actor);
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${task.payload?.visitorName || 'Visitor'} checked in successfully.`,
        payload: {
          status: 'checked_in',
        },
      })],
    };
  }

  if (task.type === 'visitor-check-out') {
    await checkOutVisitor(task.payload?.visitorId, actor);
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `${task.payload?.visitorName || 'Visitor'} checked out successfully.`,
        payload: {
          status: 'checked_out',
        },
      })],
    };
  }

  if (task.type === 'payment-reminder') {
    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: 'Reminder scheduled in demo mode.',
      })],
    };
  }

  if (task.type === 'marketplace-listing-create') {
    const created = await createMarketplaceListing({
      title: task.payload?.title,
      description: task.payload?.description,
      category: task.payload?.category,
      condition: task.payload?.condition,
      listingType: task.payload?.listingType,
      price: task.payload?.price,
      residentId: task.payload?.residentId || actor?.uid,
      residentName: task.payload?.residentName || actor?.name || 'Resident',
      flat: task.payload?.flat || actor?.flat || '',
      societyId: task.payload?.societyId || actor?.societyId,
    });

    return {
      tasks: [cloneTask(task, {
        status: 'completed',
        executionNote: `Marketplace listing ${created.title} created successfully.`,
        payload: {
          listingId: created.id,
        },
      })],
    };
  }

  return {
    tasks: [cloneTask(task, {
      status: 'failed',
      executionNote: 'This AI action is not supported in demo mode yet.',
    })],
  };
}
