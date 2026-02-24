import nodemailer from "nodemailer";

function getTransport() {
  const server = process.env.EMAIL_SERVER;
  if (server) {
    return nodemailer.createTransport(server);
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("[email] EMAIL_SERVER is not set — emails will not be sent in production");
  }
  // Fallback to Mailhog for local development
  return nodemailer.createTransport({ host: "localhost", port: 1025 });
}

const from = process.env.FROM_EMAIL || "Forever <noreply@forever.local>";

/**
 * Fire-and-forget email send. Logs errors but never throws.
 */
export function sendNotification({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  getTransport()
    .sendMail({ from, to, subject, html })
    .catch((err) => {
      console.error(`[email] Failed to send to ${to}:`, err.message);
    });
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const baseStyle = `
  font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
  color: #3d2e1f;
  line-height: 1.6;
  max-width: 560px;
  margin: 0 auto;
  padding: 32px 24px;
`;

const buttonStyle = `
  display: inline-block;
  background-color: #b8860b;
  color: #ffffff;
  text-decoration: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
`;

function wrap(body: string): string {
  return `<div style="${baseStyle}">${body}<p style="margin-top:32px;font-size:12px;color:#9a8a78;">Forever Memorial</p></div>`;
}

export function newSubmissionEmail({
  memorialName,
  submitterName,
  dashboardUrl,
}: {
  memorialName: string;
  submitterName: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `New memory submitted for ${memorialName}`,
    html: wrap(`
      <h2 style="font-family:Lora,Georgia,serif;margin:0 0 16px;">New Memory Submission</h2>
      <p><strong>${submitterName}</strong> has submitted a memory for <strong>${memorialName}</strong>.</p>
      <p>Please review it on your dashboard:</p>
      <p style="margin-top:24px;"><a href="${dashboardUrl}" style="${buttonStyle}">Review Submissions</a></p>
    `),
  };
}

export function memoryAcceptedEmail({
  memorialName,
  memorialUrl,
}: {
  memorialName: string;
  memorialUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your memory for ${memorialName} was published`,
    html: wrap(`
      <h2 style="font-family:Lora,Georgia,serif;margin:0 0 16px;">Memory Published</h2>
      <p>Your memory for <strong>${memorialName}</strong> has been accepted and is now visible on the memorial page.</p>
      <p style="margin-top:24px;"><a href="${memorialUrl}" style="${buttonStyle}">View Memorial</a></p>
    `),
  };
}

export function memoryReturnedEmail({
  memorialName,
  returnMessage,
  dashboardUrl,
}: {
  memorialName: string;
  returnMessage: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your memory for ${memorialName} needs changes`,
    html: wrap(`
      <h2 style="font-family:Lora,Georgia,serif;margin:0 0 16px;">Changes Requested</h2>
      <p>The owner of <strong>${memorialName}</strong>'s memorial page has requested changes to your memory submission.</p>
      <div style="background:#faf6f0;border-left:4px solid #b8860b;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-style:italic;">${returnMessage}</p>
      </div>
      <p>You can edit and resubmit your memory from your dashboard:</p>
      <p style="margin-top:24px;"><a href="${dashboardUrl}" style="${buttonStyle}">Edit Memory</a></p>
    `),
  };
}

export function memoryResubmittedEmail({
  memorialName,
  submitterName,
  dashboardUrl,
}: {
  memorialName: string;
  submitterName: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `A memory for ${memorialName} was resubmitted`,
    html: wrap(`
      <h2 style="font-family:Lora,Georgia,serif;margin:0 0 16px;">Memory Resubmitted</h2>
      <p><strong>${submitterName}</strong> has updated and resubmitted their memory for <strong>${memorialName}</strong>.</p>
      <p>Please review the updated submission on your dashboard:</p>
      <p style="margin-top:24px;"><a href="${dashboardUrl}" style="${buttonStyle}">Review Submissions</a></p>
    `),
  };
}
