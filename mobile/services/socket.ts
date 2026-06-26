import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const SOCKET_URL: string =
  (Constants.expoConfig?.extra?.socketUrl as string | undefined) ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => console.log('[PHOCUS] Socket connected'));
  socket.on('disconnect', (r) => console.log('[PHOCUS] Socket disconnected:', r));
  socket.on('connect_error', (e) => console.warn('[PHOCUS] Socket error:', e.message));

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
