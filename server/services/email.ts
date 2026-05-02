/**
 * Email Service — Resend
 *
 * All functions degrade gracefully when RESEND_API_KEY is not configured.
 * In that case they log what would have been sent and return a no-op result.
 *
 * Environment variables:
 *   RESEND_API_KEY  — Resend API key (required for live email)
 *   FROM_EMAIL      — Sender address, e.g. "PWE Portal <noreply@pwe.org>"
 *                     Defaults to "PWE Portal <onboarding@resend.dev>" for testing
 */

import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL =
  process.env.FROM_EMAIL || "PWE Portal <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "";

let _resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

function brandedEmail(
  title: string,
  bodyHtml: string,
  previewText?: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Inter',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:hidden;max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                <span style="color:#66DAB5;">PWE</span> Portal
              </p>
              <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#66DAB5;text-transform:uppercase;letter-spacing:0.08em;">
                Child Sponsorship
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">${title}</h2>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                This is an automated message from the PWE Child Sponsorship Portal.
                Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`;
}

function highlight(value: string): string {
  return `<strong style="color:#1e3a5f;">${value}</strong>`;
}

function infoBox(rows: [string, string][]): string {
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-size:13px;color:#6b7280;white-space:nowrap;">${label}</td>
          <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:500;">${value}</td>
        </tr>`
    )
    .join("\n");
  return `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
    ${rowsHtml}
  </table>`;
}

function actionButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:8px;padding:10px 22px;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">${label}</a>`;
}

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

async function send(
  to: string | string[],
  subject: string,
  html: string
): Promise<SendResult> {
  const client = getResendClient();
  if (!client) {
    console.log(
      `[email] (no-op — RESEND_API_KEY not set) To: ${to} | Subject: ${subject}`
    );
    return { success: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[email] Sent "${subject}" to ${to} — id: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[email] Send failed:", err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Notification: new sponsor message received
// ---------------------------------------------------------------------------

export interface NewMessageNotificationPayload {
  recipientEmail: string;
  recipientName: string;
  childName: string;
  childId: string;
  senderName: string;
  messagePreview: string;
  dbChildId: number;
}

export async function sendNewMessageNotification(
  payload: NewMessageNotificationPayload
): Promise<SendResult> {
  const profileUrl = APP_URL
    ? `${APP_URL}/children/${payload.dbChildId}`
    : null;

  const html = brandedEmail(
    "New Sponsor Message",
    [
      paragraph(
        `Hello ${highlight(payload.recipientName)}, a new message has arrived for ${highlight(payload.childName)}.`
      ),
      infoBox([
        ["From", payload.senderName],
        ["Child", `${payload.childName} (${payload.childId})`],
        ["Preview", payload.messagePreview.slice(0, 120) + (payload.messagePreview.length > 120 ? "…" : "")],
      ]),
      profileUrl
        ? actionButton("View in Portal", profileUrl)
        : paragraph("Log in to the portal to review and respond."),
    ].join("\n"),
    `New message from ${payload.senderName} for ${payload.childName}`
  );

  return send(
    payload.recipientEmail,
    `New message for ${payload.childName} — PWE Portal`,
    html
  );
}

// ---------------------------------------------------------------------------
// Notification: pending messages summary alert (for admins / case workers)
// ---------------------------------------------------------------------------

export interface PendingMessageAlertPayload {
  recipientEmail: string;
  recipientName: string;
  pendingCount: number;
}

export async function sendPendingMessageAlert(
  payload: PendingMessageAlertPayload
): Promise<SendResult> {
  const portalUrl = APP_URL || "#";

  const html = brandedEmail(
    "Pending Messages Alert",
    [
      paragraph(
        `Hello ${highlight(payload.recipientName)}, there are currently ${highlight(String(payload.pendingCount))} pending messages awaiting review in the PWE Portal.`
      ),
      actionButton("Review Messages", portalUrl),
    ].join("\n"),
    `${payload.pendingCount} pending messages need attention`
  );

  return send(
    payload.recipientEmail,
    `${payload.pendingCount} pending message${payload.pendingCount !== 1 ? "s" : ""} — PWE Portal`,
    html
  );
}

// ---------------------------------------------------------------------------
// Notification: new user welcome email
// ---------------------------------------------------------------------------

export interface WelcomeEmailPayload {
  recipientEmail: string;
  recipientName: string;
  username: string;
  temporaryPassword: string;
  role: string;
}

export async function sendUserWelcomeEmail(
  payload: WelcomeEmailPayload
): Promise<SendResult> {
  const loginUrl = APP_URL || "#";
  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    case_worker: "Case Worker",
    sponsor: "Sponsor",
  };

  const html = brandedEmail(
    "Welcome to the PWE Portal",
    [
      paragraph(
        `Hello ${highlight(payload.recipientName)}, your account has been created on the PWE Child Sponsorship Portal.`
      ),
      infoBox([
        ["Username", payload.username],
        ["Temporary Password", payload.temporaryPassword],
        ["Role", roleLabels[payload.role] || payload.role],
      ]),
      paragraph(
        "Please log in and change your password as soon as possible."
      ),
      actionButton("Log In to Portal", loginUrl),
    ].join("\n"),
    "Your PWE Portal account is ready"
  );

  return send(
    payload.recipientEmail,
    "Welcome to the PWE Child Sponsorship Portal",
    html
  );
}

// ---------------------------------------------------------------------------
// Password reset (scaffold — send a reset link)
// ---------------------------------------------------------------------------

export interface PasswordResetPayload {
  recipientEmail: string;
  recipientName: string;
  resetToken: string;
}

export async function sendPasswordResetEmail(
  payload: PasswordResetPayload
): Promise<SendResult> {
  const resetUrl = APP_URL
    ? `${APP_URL}/reset-password?token=${payload.resetToken}`
    : `#reset?token=${payload.resetToken}`;

  const html = brandedEmail(
    "Reset Your Password",
    [
      paragraph(
        `Hello ${highlight(payload.recipientName)}, a password reset was requested for your PWE Portal account.`
      ),
      paragraph("Click the button below to reset your password. This link expires in 1 hour."),
      actionButton("Reset Password", resetUrl),
      paragraph(
        `If you did not request a password reset, you can safely ignore this email.`
      ),
    ].join("\n"),
    "Reset your PWE Portal password"
  );

  return send(
    payload.recipientEmail,
    "Password Reset — PWE Portal",
    html
  );
}

// ---------------------------------------------------------------------------
// Notification: admin-generated password reset
// ---------------------------------------------------------------------------

export interface AdminPasswordResetPayload {
  recipientEmail: string;
  recipientName: string;
  username: string;
  newPassword: string;
}

export async function sendAdminPasswordResetEmail(
  payload: AdminPasswordResetPayload
): Promise<SendResult> {
  const loginUrl = APP_URL || "#";

  const html = brandedEmail(
    "Your Password Has Been Reset",
    [
      paragraph(
        `Hello ${highlight(payload.recipientName)}, an administrator has reset your PWE Portal password.`
      ),
      infoBox([
        ["Username", payload.username],
        ["New Password", payload.newPassword],
      ]),
      paragraph(
        "Please log in with the new password above and change it immediately from your account settings."
      ),
      actionButton("Log In to Portal", loginUrl),
      paragraph(
        `If you did not expect this change, please contact your administrator immediately.`
      ),
    ].join("\n"),
    "Your PWE Portal password has been reset"
  );

  return send(
    payload.recipientEmail,
    "Password Reset by Administrator — PWE Portal",
    html
  );
}

// ---------------------------------------------------------------------------
// Test email (admin utility)
// ---------------------------------------------------------------------------

export async function sendTestEmail(toEmail: string): Promise<SendResult> {
  const html = brandedEmail(
    "Email Test Successful",
    paragraph(
      "If you are reading this, the Resend email integration is working correctly."
    ),
    "PWE Portal email test"
  );

  return send(toEmail, "Email Test — PWE Portal", html);
}
