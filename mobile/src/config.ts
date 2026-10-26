export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const EMERGENCY_NUMBER = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER ?? '911';
