const INTENT_DEFINITIONS = [
  {
    id: 'visitor_access',
    agent: 'visitor',
    patterns: [
      /\b(approve|allow|permit|let in|grant)\b.*\b(visitor|guest|entry|pass|qr|otp)\b/i,
      /\bvisitor\b.*\b(approve|allow|permit)\b/i,
    ],
  },
  {
    id: 'delivery_routing',
    agent: 'delivery',
    patterns: [
      /\b(delivery|parcel|package|courier)\b.*\b(doorstep|security|gate|route|hold)\b/i,
      /\b(doorstep|security)\b.*\b(delivery|parcel|package|courier)\b/i,
    ],
  },
  {
    id: 'finance_dues',
    agent: 'finance',
    patterns: [
      /\b(due|dues|maintenance|bill|payment|razorpay|invoice)\b/i,
      /\b(remind|reminder|schedule)\b.*\b(pay|payment|dues|bill|maintenance)\b/i,
    ],
  },
  {
    id: 'complaint_support',
    agent: 'complaint',
    patterns: [
      /\b(complaint|issue|problem|ticket|leak|plumbing|electrical|security issue)\b/i,
      /\b(report|raise|file)\b.*\b(complaint|issue|problem)\b/i,
    ],
  },
  {
    id: 'staff_support',
    agent: 'staff',
    patterns: [
      /\b(staff|maid|driver|cook|househelp|attendance)\b/i,
    ],
  },
  {
    id: 'announcement_drafting',
    agent: 'announcement',
    patterns: [
      /\b(announcement|announce|notice|broadcast|circular)\b/i,
      /\b(draft|write|prepare)\b.*\b(announcement|notice)\b/i,
    ],
  },
  {
    id: 'amenity_booking',
    agent: 'booking',
    patterns: [
      /\b(book|booking|reserve|slot)\b.*\b(gym|pool|clubhouse|hall|tennis|amenity)\b/i,
      /\b(gym|pool|clubhouse|hall|tennis|amenity)\b.*\b(book|booking|reserve|slot)\b/i,
    ],
  },
];

function dedupeById(items) {
  return items.filter((item, index) => items.findIndex((entry) => entry.id === item.id) === index);
}

function classifyIntents(message = '') {
  const matched = INTENT_DEFINITIONS.filter((definition) => definition.patterns.some((pattern) => pattern.test(message)));

  if (!matched.length) {
    return [{ id: 'general_concierge', agent: 'concierge' }];
  }

  return dedupeById(matched.map(({ id, agent }) => ({ id, agent })));
}

module.exports = {
  classifyIntents,
};