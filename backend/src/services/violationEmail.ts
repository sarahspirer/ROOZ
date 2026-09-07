import prisma from '../db/prisma';

// Sends a policy violation email via Resend (or logs if not configured)
export async function sendViolationEmail(studentId: string, description: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true, email: true, school: { select: { name: true, policyEmailsEnabled: true } } } } },
  });

  if (!student?.user?.school?.policyEmailsEnabled) return;

  const { name, email, school } = student.user;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log(`[ViolationEmail] Would send to ${email}: ${description}`);
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'ROOZ <no-reply@myrooz.com>',
      to: [email],
      subject: `Phone Policy Violation — ${school.name}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="font-size:24px;font-weight:900;color:#C8102E;margin-bottom:24px">rooz</div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Phone Policy Violation</h2>
          <p style="color:#6e6e73;font-size:15px;margin-bottom:24px">Hi ${name}, a phone policy violation was recorded for your device.</p>
          <div style="background:#f5f5f7;border-radius:12px;padding:16px;margin-bottom:24px">
            <div style="font-size:13px;color:#6e6e73;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">violation</div>
            <div style="font-size:15px;font-weight:600;color:#1d1d1f">${description}</div>
          </div>
          <p style="color:#6e6e73;font-size:13px">This is an automated message from ${school.name} via ROOZ. Contact your school administrator with questions.</p>
        </div>
      `,
    }),
  });
}
