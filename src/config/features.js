import { DEFAULT_CITY_ID } from './cities';

export const FEATURES = Object.freeze({
  VISITOR_OTP: true,
  VISITOR_QR: true,
  AMENITY_BOOKINGS: true,
  SECURITY_LOGS: true,
  ANNOUNCEMENTS: true,
  COMPLAINTS: true,
  PAYMENTS_RAZORPAY: true,
  FCM_NOTIFICATIONS: true,
  WHATSAPP_ALERTS: true,
  AI_CHATBOT: true,
  AI_RISK_SCORE: false,
  AI_ANNOUNCEMENTS: false,
  IOT_GATE: false,
  FACE_RECOGNITION: false,
  LICENSE_PLATE: false,
  MULTI_LANGUAGE: false,
});

export const CITY_FEATURE_OVERRIDES = Object.freeze({
  bengaluru: {},
  chennai: {
    MULTI_LANGUAGE: true,
  },
});

export function resolveFeatureFlags({ cityId = DEFAULT_CITY_ID, societySettings = {}, overrides = {} } = {}) {
  const cityFlags = CITY_FEATURE_OVERRIDES[cityId] || {};
  const societyFlags = societySettings.featureFlags || societySettings.features || {};

  return {
    ...FEATURES,
    ...cityFlags,
    ...societyFlags,
    ...overrides,
  };
}

export function isFeatureEnabled(featureKey, context) {
  return Boolean(resolveFeatureFlags(context)[featureKey]);
}