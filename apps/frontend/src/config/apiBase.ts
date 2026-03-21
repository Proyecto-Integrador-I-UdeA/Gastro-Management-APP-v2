/** Backend origin — override with NEXT_PUBLIC_API_URL in .env.local for deploys */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');
