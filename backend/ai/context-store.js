const DEFAULT_SOCIETY_ID = 'brigade-metropolis';
const CONTEXT_FETCH_LIMIT = Number(process.env.AI_CONTEXT_FETCH_LIMIT || 75);
const CONTEXT_FETCH_TIMEOUT_MS = Number(process.env.AI_CONTEXT_FETCH_TIMEOUT_MS || 2500);

function getSocietyCollection(db, societyId, collectionName) {
  return db.collection('societies').doc(societyId || DEFAULT_SOCIETY_ID).collection(collectionName);
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    }),
  ]);
}

function mergeUserProfile(baseUser = {}, profile = {}) {
  return {
    ...baseUser,
    uid: baseUser.uid || profile.uid || null,
    name: profile.name || baseUser.name || 'Resident',
    role: profile.role || baseUser.role || 'resident',
    flat: profile.flat || baseUser.flat || null,
    societyId: profile.societyId || baseUser.societyId || DEFAULT_SOCIETY_ID,
    language: profile.language || baseUser.language || 'en',
    email: profile.email || baseUser.email || '',
    mobile: profile.mobile || baseUser.mobile || '',
    householdInfo: profile.householdInfo || baseUser.householdInfo || null,
  };
}

function itemKey(item = {}, index = 0) {
  if (item.id) return `id:${item.id}`;
  if (item.docId) return `doc:${item.docId}`;
  const composite = [
    item.userId,
    item.residentId,
    item.flat,
    item.title,
    item.name,
    item.category,
    item.createdAt,
  ].filter(Boolean).join('|');
  return composite ? `composite:${composite}` : `index:${index}`;
}

function mergeArrays(serverItems, snapshotItems) {
  const serverList = Array.isArray(serverItems) ? serverItems : [];
  const snapshotList = Array.isArray(snapshotItems) ? snapshotItems : [];

  if (!serverList.length) return snapshotList;
  if (!snapshotList.length) return serverList;

  const merged = new Map();
  for (const [index, item] of snapshotList.entries()) {
    merged.set(itemKey(item, index), item);
  }
  for (const [index, item] of serverList.entries()) {
    merged.set(itemKey(item, index), {
      ...merged.get(itemKey(item, index)),
      ...item,
    });
  }

  return [...merged.values()];
}

async function safeReadCollection(db, societyId, collectionName) {
  try {
    const snapshot = await withTimeout(
      getSocietyCollection(db, societyId, collectionName).limit(CONTEXT_FETCH_LIMIT).get(),
      CONTEXT_FETCH_TIMEOUT_MS,
      null,
    );
    if (!snapshot?.docs) {
      return [];
    }
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch {
    return [];
  }
}

function filterResidentPayments(items, actor) {
  return items.filter((item) => item.userId === actor.uid || item.residentId === actor.uid || item.flat === actor.flat);
}

function filterResidentComplaints(items, actor) {
  return items.filter((item) => item.residentId === actor.uid || item.userId === actor.uid || item.flat === actor.flat);
}

function filterResidentBookings(items, actor) {
  return items.filter((item) => item.residentId === actor.uid || item.userId === actor.uid || item.flat === actor.flat);
}

function filterResidentStaff(items, actor) {
  return items.filter((item) => item.residentId === actor.uid || item.userId === actor.uid || item.flat === actor.flat);
}

function filterResidentVisitors(items, actor) {
  return items.filter((item) => item.residentId === actor.uid || item.flat === actor.flat);
}

async function hydrateAgentRequestContext(request, dependencies) {
  const requestedUser = request?.user || {};
  const firebaseStatus = dependencies?.getFirebaseStatus?.();

  if (!requestedUser.uid || !firebaseStatus?.configured || !dependencies?.getDb) {
    return {
      ...request,
      contextMeta: {
        source: 'client-snapshot',
        usedServerData: false,
        hydratedAt: new Date().toISOString(),
        fetchedCollections: {},
      },
    };
  }

  const db = dependencies.getDb();
  const profileSnapshot = await withTimeout(
    db.collection('users').doc(requestedUser.uid).get().catch(() => null),
    CONTEXT_FETCH_TIMEOUT_MS,
    null,
  );
  const profile = profileSnapshot?.exists ? profileSnapshot.data() : {};
  const mergedUser = mergeUserProfile(requestedUser, profile);
  const societyId = mergedUser.societyId || DEFAULT_SOCIETY_ID;

  const [payments, complaints, bookings, staffMembers, staffAttendance, visitors, announcements] = await Promise.all([
    safeReadCollection(db, societyId, 'payments'),
    safeReadCollection(db, societyId, 'complaints'),
    safeReadCollection(db, societyId, 'facilityBookings'),
    safeReadCollection(db, societyId, 'residentStaff'),
    safeReadCollection(db, societyId, 'residentStaffAttendance'),
    safeReadCollection(db, societyId, 'visitors'),
    safeReadCollection(db, societyId, 'announcements'),
  ]);

  const mergedSnapshot = {
    ...(request.contextSnapshot || {}),
    payments: mergeArrays(filterResidentPayments(payments, mergedUser), request.contextSnapshot?.payments),
    complaints: mergeArrays(filterResidentComplaints(complaints, mergedUser), request.contextSnapshot?.complaints),
    bookings: mergeArrays(filterResidentBookings(bookings, mergedUser), request.contextSnapshot?.bookings),
    staffMembers: mergeArrays(filterResidentStaff(staffMembers, mergedUser), request.contextSnapshot?.staffMembers),
    staffAttendance: mergeArrays(filterResidentStaff(staffAttendance, mergedUser), request.contextSnapshot?.staffAttendance),
    visitors: mergeArrays(filterResidentVisitors(visitors, mergedUser), request.contextSnapshot?.visitors),
    announcements: mergeArrays(announcements, request.contextSnapshot?.announcements),
  };

  return {
    ...request,
    user: mergedUser,
    contextSnapshot: mergedSnapshot,
    contextMeta: {
      source: 'firestore+client-snapshot',
      usedServerData: true,
      hydratedAt: new Date().toISOString(),
      fetchedCollections: {
        payments: mergedSnapshot.payments.length,
        complaints: mergedSnapshot.complaints.length,
        bookings: mergedSnapshot.bookings.length,
        staffMembers: mergedSnapshot.staffMembers.length,
        staffAttendance: mergedSnapshot.staffAttendance.length,
        visitors: mergedSnapshot.visitors.length,
        announcements: mergedSnapshot.announcements.length,
      },
    },
  };
}

module.exports = {
  hydrateAgentRequestContext,
};