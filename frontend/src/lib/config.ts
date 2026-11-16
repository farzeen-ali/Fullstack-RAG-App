import Constants from 'expo-constants';

const BACKEND_PORT = 3000;

/**
 * Resolution order:
 * 1. EXPO_PUBLIC_BACKEND_URL from frontend/.env (recommended, e.g. http://192.168.1.50:3000)
 * 2. The LAN IP of the machine running Metro (what Expo Go already connects to) on port 3000
 * 3. localhost (simulators / web)
 */
function resolveBackendUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${BACKEND_PORT}`;

  return `http://localhost:${BACKEND_PORT}`;
}

export const BACKEND_URL = resolveBackendUrl();

export const MAX_QUESTION_LENGTH = 1000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
