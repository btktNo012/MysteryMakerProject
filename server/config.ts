export const PORT = process.env.PORT || 3001;

const baseAllowedOrigins = [
  'http://localhost:5173',
];

if (process.env.FRONTEND_URL) {
  baseAllowedOrigins.push(process.env.FRONTEND_URL);
}

export const allowedOrigins = baseAllowedOrigins;

// Timers
export const READING_TIME_SECONDS = 600; // 10 minutes (未使用だが保持)
export const READING_TIME_SECONDS_EXTENSION = 180; // 3 minutes

// Jobs intervals
export const DISCUSSION_TIMER_INTERVAL_MS = 1000;
export const ROOM_CLEANUP_INTERVAL = 1000 * 60 * 60 * 24; // 24時間ごと
export const ROOM_INACTIVITY_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 14; // 14日間

