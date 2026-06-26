import { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '../types/events';
import { eventBus } from '../events/eventBus';
import { getSchoolComplianceSummary } from '../services/focusScore';
import { log } from '../middleware/logger';

type PhocusServer = Server<ClientToServerEvents, ServerToClientEvents>;
type PhocusSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: PhocusServer): void {
  io.on('connection', (socket: PhocusSocket) => {
    log('info', `Socket connected: ${socket.id}`);

    socket.on('join:school', (schoolId) => {
      socket.join(`school:${schoolId}`);
      log('info', `Socket ${socket.id} joined school:${schoolId}`);

      // Send current compliance snapshot on join
      getSchoolComplianceSummary(schoolId)
        .then((summary) => socket.emit('compliance:update', summary))
        .catch((err) => log('error', 'Failed to fetch compliance summary', err));
    });

    socket.on('join:class', (classId) => {
      socket.join(`class:${classId}`);
    });

    socket.on('join:student', (studentId) => {
      socket.join(`student:${studentId}`);
    });

    socket.on('leave:school', (schoolId) => {
      socket.leave(`school:${schoolId}`);
    });

    socket.on('leave:class', (classId) => {
      socket.leave(`class:${classId}`);
    });

    socket.on('disconnect', () => {
      log('info', `Socket disconnected: ${socket.id}`);
    });
  });

  // Wire internal event bus → Socket.io broadcasts

  eventBus.on('compliance:updated', (event) => {
    io.to(`school:${event.schoolId}`).emit('compliance:update', event);
  });

  eventBus.on('activity:logged', (event) => {
    // We need to look up the schoolId to route this; for now emit to all
    io.emit('activity:new', event);
  });

  eventBus.on('alert:raised', (event) => {
    io.emit('alert:new', event);
  });

  eventBus.on('class:status:changed', (event) => {
    io.to(`class:${event.classId}`).emit('class:status', event);
  });

  eventBus.on('student:score:updated', (event) => {
    io.to(`student:${event.studentId}`).emit('student:score', event);
  });

  eventBus.on('student:violation', (data) => {
    io.to(`student:${data.studentId}`).emit('student:violation', data);
  });

  eventBus.on('compliance:recalculate', async (schoolId) => {
    try {
      const summary = await getSchoolComplianceSummary(schoolId);
      io.to(`school:${schoolId}`).emit('compliance:update', summary);
    } catch (err) {
      log('error', `Failed to recalculate compliance for school ${schoolId}`, err);
    }
  });
}
