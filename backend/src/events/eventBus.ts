import { EventEmitter } from 'events';
import type { ActivityEvent, AlertEvent, ComplianceUpdateEvent, ClassStatusEvent, StudentScoreEvent } from '../types/events';

export type PhocusEvents = {
  'compliance:recalculate': [schoolId: string];
  'student:score:updated': [event: StudentScoreEvent];
  'activity:logged': [event: ActivityEvent];
  'alert:raised': [event: AlertEvent];
  'class:status:changed': [event: ClassStatusEvent];
  'compliance:updated': [event: ComplianceUpdateEvent];
  'student:offline': [data: { studentId: string; studentName: string }];
  'student:violation': [data: { studentId: string; description: string; level: string; app?: string }];
};

class PhocusEventBus extends EventEmitter {
  emit<K extends keyof PhocusEvents>(event: K, ...args: PhocusEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof PhocusEvents>(
    event: K,
    listener: (...args: PhocusEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof PhocusEvents>(
    event: K,
    listener: (...args: PhocusEvents[K]) => void,
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

export const eventBus = new PhocusEventBus();
eventBus.setMaxListeners(50);
