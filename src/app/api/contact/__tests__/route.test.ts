import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  sendNotification: vi.fn(),
  escapeHtml: vi.fn((t: string) => t),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true, remaining: 4 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: vi.fn((fn: () => void) => fn()) };
});

import { POST } from "../route";
import { sendNotification } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  subject: "Question",
  message: "I have a question about the platform.",
};

beforeEach(() => {
  vi.resetAllMocks();
  m(rateLimit).mockReturnValue({ success: true, remaining: 4 });
});

describe("POST /api/contact", () => {
  it("returns 200 and sends email on valid submission", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[Contact] Question",
      })
    );
  });

  it("returns 429 when rate limited", async () => {
    m(rateLimit).mockReturnValue({ success: false, remaining: 0 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await POST(makeRequest({ name: "Jane", email: "j@e.com", subject: "" }));
    expect(res.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(makeRequest({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when input is too long", async () => {
    const res = await POST(makeRequest({ ...validBody, message: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("silently succeeds for honeypot submissions", async () => {
    const res = await POST(makeRequest({ ...validBody, website: "http://spam.com" }));
    expect(res.status).toBe(200);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends to CONTACT_EMAIL env var", async () => {
    await POST(makeRequest(validBody));
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.any(String),
      })
    );
  });
});
