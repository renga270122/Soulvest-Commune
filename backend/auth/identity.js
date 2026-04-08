const { verifyDemoSessionToken } = require('./demo-session');

function getBearerToken(authorizationHeader = '') {
  const [scheme, token] = String(authorizationHeader).split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) {
    return null;
  }

  return token.trim();
}

async function verifyFirebaseIdentityToken(token, dependencies) {
  const firebaseStatus = dependencies.getFirebaseStatus();
  if (!firebaseStatus.configured) {
    return null;
  }

  const adminAuth = dependencies.getAdminAuth();
  if (!adminAuth) {
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  let profile = null;

  try {
    const snapshot = await dependencies.getDb().collection('users').doc(decoded.uid).get();
    if (snapshot.exists) {
      profile = snapshot.data();
    }
  } catch {
    profile = null;
  }

  return {
    uid: decoded.uid,
    name: profile?.name || decoded.name || 'Resident',
    email: profile?.email || decoded.email || '',
    mobile: profile?.mobile || decoded.phone_number || '',
    role: profile?.role || 'resident',
    flat: profile?.flat || '',
    cityId: profile?.cityId || '',
    societyId: profile?.societyId || 'brigade-metropolis',
    language: profile?.language || 'en',
    authProvider: 'firebase',
  };
}

async function resolveAuthenticatedActor(req, requestedUser, dependencies) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return {
      actor: requestedUser,
      authenticated: false,
      authProvider: null,
      errorCode: 'missing_token',
      errorMessage: 'Authenticated execution requires a valid session token.',
    };
  }

  try {
    const actor = await verifyFirebaseIdentityToken(token, dependencies);
    if (requestedUser?.uid && actor?.uid && requestedUser.uid !== actor.uid) {
      return {
        actor: null,
        authenticated: false,
        authProvider: actor.authProvider,
        errorCode: 'actor_mismatch',
        errorMessage: 'The authenticated session does not match the requested user.',
      };
    }

    return {
      actor,
      authenticated: true,
      authProvider: actor.authProvider,
      errorCode: null,
      errorMessage: null,
    };
  } catch (firebaseError) {
    try {
      const actor = verifyDemoSessionToken(token);
      if (requestedUser?.uid && actor?.uid && requestedUser.uid !== actor.uid) {
        return {
          actor: null,
          authenticated: false,
          authProvider: actor.authProvider,
          errorCode: 'actor_mismatch',
          errorMessage: 'The authenticated session does not match the requested user.',
        };
      }

      return {
        actor,
        authenticated: true,
        authProvider: actor.authProvider,
        errorCode: null,
        errorMessage: null,
      };
    } catch {
      return {
        actor: requestedUser,
        authenticated: false,
        authProvider: null,
        errorCode: 'invalid_token',
        errorMessage: 'Authenticated execution requires a valid session token.',
      };
    }
  }
}

module.exports = {
  resolveAuthenticatedActor,
};