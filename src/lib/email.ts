import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_test_key");

const FROM = process.env.EMAIL_FROM ?? "Kirby Learning Academy <noreply@kirbyacademy.com>";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email via Resend.
 * In development without a real API key, logs instead of sending.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_test_key") {
    console.log("[email] DEV MODE — would send:", payload.to, payload.subject);
    return;
  }
  await resend.emails.send({ from: FROM, ...payload });
}

// ── Branded templates ─────────────────────────────────────────────────────────

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width" />
<title>Kirby Learning Academy</title>
</head>
<body style="margin:0;padding:0;background:#0a1628;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f1f3d;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- header -->
        <tr>
          <td style="background:#0a1628;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <span style="color:#cc3d00;font-size:18px;font-weight:700;letter-spacing:1px;">KIRBY LEARNING ACADEMY</span>
          </td>
        </tr>
        <!-- body -->
        <tr><td style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.6;">${content}</td></tr>
        <!-- footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.3);font-size:12px;">
            &copy; ${new Date().getFullYear()} Kirby Corporation. This is an automated message from Kirby Learning Academy.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#cc3d00;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${text}</a>`;
}

export function courseDueSoonEmail(name: string, courseTitle: string, dueDate: string, link: string): string {
  return layout(`
    <h2 style="color:#fff;margin-top:0;">Training Due Soon</h2>
    <p>Hi ${name},</p>
    <p>Your training <strong style="color:#fff;">${courseTitle}</strong> is due on <strong style="color:#cc3d00;">${dueDate}</strong>.</p>
    <p>Please complete it before the deadline to stay compliant.</p>
    ${btn("Open Course", link)}`);
}

export function courseOverdueEmail(name: string, courseTitle: string, daysOverdue: number, link: string): string {
  return layout(`
    <h2 style="color:#ef4444;margin-top:0;">Overdue Training</h2>
    <p>Hi ${name},</p>
    <p>Your training <strong style="color:#fff;">${courseTitle}</strong> is <strong style="color:#ef4444;">${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue</strong>.</p>
    <p>Please complete it immediately to maintain compliance.</p>
    ${btn("Complete Now", link)}`);
}

export function certExpiringEmail(name: string, certName: string, expiresOn: string, renewalLink: string): string {
  return layout(`
    <h2 style="color:#eab308;margin-top:0;">Certification Expiring Soon</h2>
    <p>Hi ${name},</p>
    <p>Your certification <strong style="color:#fff;">${certName}</strong> expires on <strong style="color:#eab308;">${expiresOn}</strong>.</p>
    <p>Complete your renewal course before the expiry date to maintain your status.</p>
    ${btn("Start Renewal", renewalLink)}`);
}

export function certExpiredEmail(name: string, certName: string): string {
  return layout(`
    <h2 style="color:#ef4444;margin-top:0;">Certification Expired</h2>
    <p>Hi ${name},</p>
    <p>Your certification <strong style="color:#fff;">${certName}</strong> has expired. Please contact your compliance officer or complete a renewal course immediately.</p>`);
}

export function managerEscalationEmail(
  managerName: string, employeeName: string, courseTitle: string, daysOverdue: number, link: string
): string {
  return layout(`
    <h2 style="color:#ef4444;margin-top:0;">Team Member Overdue — Action Required</h2>
    <p>Hi ${managerName},</p>
    <p><strong style="color:#fff;">${employeeName}</strong> is <strong style="color:#ef4444;">${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue</strong> on the training: <strong style="color:#fff;">${courseTitle}</strong>.</p>
    <p>Please follow up with them directly to ensure compliance.</p>
    ${btn("View Team Dashboard", link)}`);
}

export function broadcastEmail(title: string, body: string): string {
  return layout(`
    <h2 style="color:#fff;margin-top:0;">${title}</h2>
    <p>${body.replace(/\n/g, "<br/>")}</p>`);
}
