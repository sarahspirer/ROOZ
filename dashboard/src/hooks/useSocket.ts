import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types';
import { usePhocusStore } from '../store/phocusStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

type PhocusSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: PhocusSocket | null = null;

export function useSocket(): PhocusSocket | null {
  const socketRef = useRef<PhocusSocket | null>(null);
  const { auth, setCompliance, pushActivity, pushAlert, setClassStatus, setStudentScore } =
    usePhocusStore();

  useEffect(() => {
    if (!auth.token || !auth.user) return;

    // Reuse existing socket if already connected
    if (!socketInstance || !socketInstance.connected) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: auth.token },
        transports: ['websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
    }

    const socket = socketInstance;
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ROOZ Socket] Connected:', socket.id);
      socket.emit('join:school', auth.user!.schoolId);
    });

    socket.on('compliance:update', setCompliance);
    socket.on('activity:new', pushActivity);
    socket.on('alert:new', pushAlert);
    socket.on('class:status', setClassStatus);
    socket.on('student:score', setStudentScore);

    socket.on('disconnect', (reason) => {
      console.warn('[ROOZ Socket] Disconnected:', reason);
    });

    return () => {
      socket.off('compliance:update', setCompliance);
      socket.off('activity:new', pushActivity);
      socket.off('alert:new', pushAlert);
      socket.off('class:status', setClassStatus);
      socket.off('student:score', setStudentScore);
    };
  }, [auth.token, auth.user]);

  return socketRef.current;
}
