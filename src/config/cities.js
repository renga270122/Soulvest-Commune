export const CITY_CONFIG = Object.freeze({
  bengaluru: {
    name: 'Bengaluru',
    state: 'Karnataka',
    language: 'kn',
    currency: 'INR',
    pricing: {
      free: { maxUnits: 50, price: 0 },
      basic: { maxUnits: 200, pricePerUnit: 8 },
      pro: { maxUnits: 999, pricePerUnit: 12 },
    },
    theme: 'karnataka',
    active: true,
  },
  chennai: {
    name: 'Chennai',
    state: 'Tamil Nadu',
    language: 'ta',
    currency: 'INR',
    pricing: {
      free: { maxUnits: 50, price: 0 },
      basic: { maxUnits: 200, pricePerUnit: 6 },
      pro: { maxUnits: 999, pricePerUnit: 10 },
    },
    theme: 'tamilnadu',
    active: false,
  },
});

export const DEFAULT_CITY_ID = import.meta.env.VITE_DEFAULT_CITY_ID || 'bengaluru';

export function getCityConfig(cityId = DEFAULT_CITY_ID) {
  return CITY_CONFIG[cityId] || CITY_CONFIG[DEFAULT_CITY_ID];
}