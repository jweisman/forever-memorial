import { NextResponse } from "next/server";
import { sendNotification, escapeHtml } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withHandler } from "@/lib/api-error";
import { after } from "next/server";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "leolamforever@gmail.com";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

export const POST = withHandler(async (request: Request) => {
  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `contact:${ip}`, limit: 5, windowMs: 300_000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();

  // Honeypot check — if the hidden "website" field has a value, it's a bot
  if (body.website) {
    // Silently succeed to not reveal the trap
    return NextResponse.json({ success: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (name.length > 200 || email.length > 200 || subject.length > 300 || message.length > 5000) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Verify Turnstile token if configured
  if (TURNSTILE_SECRET) {
    const token = body.turnstileToken;
    if (!token) {
      return NextResponse.json({ error: "CAPTCHA verification required" }, { status: 400 });
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
    }
  }

  const html = `
    <div style="font-family:'Source Sans 3','Segoe UI',sans-serif;color:#3d2e1f;line-height:1.6;max-width:560px;margin:0 auto;padding:32px 24px;">
      <h2 style="font-family:Lora,Georgia,serif;margin:0 0 16px;">New Contact Form Submission</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;width:80px;">Name:</td><td style="padding:8px 0;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Email:</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Subject:</td><td style="padding:8px 0;">${escapeHtml(subject)}</td></tr>
      </table>
      <div style="background:#faf6f0;border-left:4px solid #b8860b;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>
      <p style="margin-top:32px;font-size:12px;color:#9a8a78;">Sent from the Forever Memorial contact form</p>
    </div>
  `;

  after(() =>
    sendNotification({
      to: CONTACT_EMAIL,
      subject: `[Contact] ${subject}`,
      html,
    })
  );

  return NextResponse.json({ success: true });
});
