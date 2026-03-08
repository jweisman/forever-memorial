import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted before const declarations — use vi.hoisted() so
// the mock variables exist before the factory runs.
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn().mockResolvedValue({});
  const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });
  return { mockSendMail, mockCreateTransport };
});
vi.mock("nodemailer", () => ({ default: { createTransport: mockCreateTransport } }));

import {
  escapeHtml,
  sendNotification,
  newSubmissionEmail,
  memoryAcceptedEmail,
  memoryReturnedEmail,
  memoryResubmittedEmail,
} from "@/lib/email";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("1 > 0")).toBe("1 &gt; 0");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#039;s fine");
  });

  it("escapes a full XSS payload", () => {
    const input = '<script>alert("xss")</script>';
    const output = escapeHtml(input);
    expect(output).not.toContain("<script>");
    expect(output).toContain("&lt;script&gt;");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes all special characters in one string", () => {
    expect(escapeHtml("& < > \" '")).toBe(
      "&amp; &lt; &gt; &quot; &#039;"
    );
  });
});

describe("newSubmissionEmail", () => {
  const params = {
    memorialName: "Jane Doe",
    submitterName: "Bob Smith",
    dashboardUrl: "https://example.com/dashboard",
  };

  it("includes the memorial name in the subject", () => {
    const { subject } = newSubmissionEmail(params);
    expect(subject).toContain("Jane Doe");
  });

  it("includes the submitter name in the HTML body", () => {
    const { html } = newSubmissionEmail(params);
    expect(html).toContain("Bob Smith");
  });

  it("HTML-escapes a malicious memorial name", () => {
    const { html } = newSubmissionEmail({
      ...params,
      memorialName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("HTML-escapes a malicious submitter name", () => {
    const { html } = newSubmissionEmail({
      ...params,
      submitterName: "<b>hacker</b>",
    });
    expect(html).not.toContain("<b>hacker</b>");
    expect(html).toContain("&lt;b&gt;hacker&lt;/b&gt;");
  });

  it("includes the dashboard URL", () => {
    const { html } = newSubmissionEmail(params);
    expect(html).toContain(params.dashboardUrl);
  });
});

describe("memoryAcceptedEmail", () => {
  const params = {
    memorialName: "Jane Doe",
    memorialUrl: "https://example.com/memorial/jane-doe",
  };

  it("includes the memorial name in the subject", () => {
    const { subject } = memoryAcceptedEmail(params);
    expect(subject).toContain("Jane Doe");
  });

  it("HTML-escapes a malicious memorial name in the body", () => {
    const { html } = memoryAcceptedEmail({
      ...params,
      memorialName: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("includes the memorial URL", () => {
    const { html } = memoryAcceptedEmail(params);
    expect(html).toContain(params.memorialUrl);
  });
});

describe("memoryReturnedEmail", () => {
  const params = {
    memorialName: "Jane Doe",
    returnMessage: "Please add more details.",
    dashboardUrl: "https://example.com/dashboard",
  };

  it("includes the memorial name in the subject", () => {
    const { subject } = memoryReturnedEmail(params);
    expect(subject).toContain("Jane Doe");
  });

  it("HTML-escapes a malicious return message", () => {
    const { html } = memoryReturnedEmail({
      ...params,
      returnMessage: "<script>steal()</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes the return message in the body", () => {
    const { html } = memoryReturnedEmail(params);
    expect(html).toContain("Please add more details.");
  });
});

describe("memoryResubmittedEmail", () => {
  const params = {
    memorialName: "Jane Doe",
    submitterName: "Bob Smith",
    dashboardUrl: "https://example.com/dashboard",
  };

  it("includes the memorial name in the subject", () => {
    const { subject } = memoryResubmittedEmail(params);
    expect(subject).toContain("Jane Doe");
  });

  it("HTML-escapes a malicious submitter name", () => {
    const { html } = memoryResubmittedEmail({
      ...params,
      submitterName: '</p><script>evil()</script>',
    });
    expect(html).not.toContain("<script>");
  });

  it("includes the submitter name in the body", () => {
    const { html } = memoryResubmittedEmail(params);
    expect(html).toContain("Bob Smith");
  });
});

// ---------------------------------------------------------------------------
// sendNotification
// ---------------------------------------------------------------------------

describe("sendNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMAIL_SERVER;
    delete process.env.EMAIL_CUSTOM_HEADER;
    mockSendMail.mockResolvedValue({});
  });

  it("calls sendMail with the correct to/subject/html", async () => {
    sendNotification({ to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" });
    // sendMail is called synchronously (fire-and-forget starts the promise)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
      })
    );
  });

  it("uses SMTP transport when EMAIL_SERVER is set", () => {
    process.env.EMAIL_SERVER = "smtp://localhost:1025";
    sendNotification({ to: "a@b.com", subject: "S", html: "" });
    expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");
  });

  it("falls back to Mailhog when EMAIL_SERVER is not set", () => {
    sendNotification({ to: "a@b.com", subject: "S", html: "" });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 1025 })
    );
  });

  it("includes a custom header when EMAIL_CUSTOM_HEADER is set", () => {
    process.env.EMAIL_CUSTOM_HEADER = "X-SES-CONFIG: my-set";
    sendNotification({ to: "a@b.com", subject: "S", html: "" });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-SES-CONFIG": "my-set" },
      })
    );
  });

  it("sends no custom headers when EMAIL_CUSTOM_HEADER is not set", () => {
    sendNotification({ to: "a@b.com", subject: "S", html: "" });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ headers: {} })
    );
  });

  it("sends no custom headers when EMAIL_CUSTOM_HEADER has no ': ' separator", () => {
    process.env.EMAIL_CUSTOM_HEADER = "malformed-header";
    sendNotification({ to: "a@b.com", subject: "S", html: "" });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ headers: {} })
    );
  });

  it("does not throw when sendMail rejects (fire-and-forget)", async () => {
    mockSendMail.mockRejectedValue(new Error("SMTP down"));
    expect(() =>
      sendNotification({ to: "a@b.com", subject: "S", html: "" })
    ).not.toThrow();
  });
});
