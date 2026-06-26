import { ViolationLevel } from '../types/events';
import { log } from '../middleware/logger';

// In production this would integrate with SendGrid, Twilio, FCM, etc.
// For now it logs the notification and returns success.

const LEVEL_LABELS: Record<ViolationLevel, string> = {
  WARNING: 'Warning',
  RESTRICTION: 'Restriction Applied',
  ADMIN_FLAG: 'Administrator Flag',
  ESCALATION: 'Urgent Escalation',
};

export async function sendParentAlert(
  parentEmail: string,
  studentName: string,
  level: ViolationLevel,
  description: string,
  appAttempted?: string,
): Promise<void> {
  const subject = `[PHOCUS] ${LEVEL_LABELS[level]}: ${studentName}`;
  const body = [
    `Dear Parent/Guardian,`,
    ``,
    `A phone policy violation has been recorded for ${studentName}.`,
    ``,
    `Violation level: ${LEVEL_LABELS[level]}`,
    `Details: ${description}`,
    appAttempted ? `App attempted: ${appAttempted}` : '',
    ``,
    `Please speak with your student about phone policy compliance.`,
    ``,
    `— PHOCUS School Safety System`,
  ]
    .filter(Boolean)
    .join('\n');

  // TODO: replace with real email provider
  log('info', `[EMAIL] To: ${parentEmail} | Subject: ${subject}`);
  log('info', `[EMAIL] Body preview: ${body.slice(0, 120)}...`);
}

export async function sendTeacherAlert(
  teacherEmail: string,
  studentName: string,
  description: string,
): Promise<void> {
  log('info', `[EMAIL] Teacher alert → ${teacherEmail}: ${studentName} — ${description}`);
}

export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  // TODO: integrate with FCM / APNs
  log('info', `[PUSH] Device: ${deviceToken} | ${title}: ${body}`, data);
}

export async function sendStudentWarning(
  deviceToken: string,
  message: string,
): Promise<void> {
  await sendPushNotification(deviceToken, 'PHOCUS Warning', message, {
    type: 'violation_warning',
  });
}
