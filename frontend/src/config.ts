// src/config.ts

const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = isLocalhost

  ? 'http://localhost/livrcart/demoark/api'
  : (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes(':5173')
    ? `${window.location.origin}/api`
    : 'https://livincart.bizools.in/api');
