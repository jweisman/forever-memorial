import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { sendNotification } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    memory: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendNotification: vi.fn(),
  memoryAcceptedEmail: vi.fn().mockReturnValue({ subject: "accepted", html: "<p>accepted</p>" }),
  memoryReturnedEmail: vi.fn().mockReturnValue({ subject: "returned", html: "<p>returned</p>" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((fn: () => void) => fn()) };
});

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const SUBMITTER_ID = "submitter-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const MEMORY_ID = "memory-001";

const mockMemorial = {
  ownerId: OWNER_ID,
  name: "Jane Doe",
  slug: "memorial-001-jane-doe",
};

const mockMemory = {
  id: MEMORY_ID,
  memorialId: MEMORIAL_ID,
  submitterId: SUBMITTER_ID,
  name: "Bob Smith",
  text: "A wonderful person",
  status: "PENDING",
  returnMessage: null,
  submitter: { email: "bob@example.com" },
};

// Shorthand cast for vi.fn()-backed prisma methods
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/memories/${MEMORY_ID}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeParams(overrides?: Partial<{ id: string; memoryId: string }>) {
  return {
    params: Promise.resolve({ id: MEMORIAL_ID, memoryId: MEMORY_ID, ...overrides }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/memories/[memoryId]/review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Happy-path defaults
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 59 });
    m(prisma.memorial.findUnique).mockResolvedValue(mockMemorial);
    m(prisma.memory.findUnique).mockResolvedValue(mockMemory);
    m(prisma.memory.update).mockResolvedValue({ ...mockMemory, status: "ACCEPTED" });
  });

  // --- Auth & guard ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/disabled/i);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockReturnValue({ success: false, remaining: 0 });
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memory not found", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when memory belongs to a different memorial", async () => {
    m(prisma.memory.findUnique).mockResolvedValue({
      ...mockMemory,
      memorialId: "different-memorial",
    });
    const res = await POST(makeRequest({ action: "accept" }), makeParams());
    expect(res.status).toBe(404);
  });

  // --- Input validation ---

  it("returns 400 for an invalid action", async () => {
    const res = await POST(makeRequest({ action: "delete" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/action/i);
  });

  it("returns 400 when action is 'return' with no returnMessage", async () => {
    const res = await POST(makeRequest({ action: "return" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is 'return' with a blank returnMessage", async () => {
    const res = await POST(
      makeRequest({ action: "return", returnMessage: "   " }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  // --- Happy path: accept ---

  it("accepts a memory, sets status to ACCEPTED, and emails the submitter", async () => {
    m(prisma.memory.update).mockResolvedValue({ ...mockMemory, status: "ACCEPTED" });

    const res = await POST(makeRequest({ action: "accept" }), makeParams());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ACCEPTED");
    expect(vi.mocked(sendNotification)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "bob@example.com" })
    );
  });

  it("does not send an email when accepting if submitter has no email", async () => {
    m(prisma.memory.findUnique).mockResolvedValue({
      ...mockMemory,
      submitter: { email: null },
    });
    m(prisma.memory.update).mockResolvedValue({ ...mockMemory, status: "ACCEPTED" });

    const res = await POST(makeRequest({ action: "accept" }), makeParams());

    expect(res.status).toBe(200);
    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  // --- Happy path: ignore ---

  it("ignores a memory, sets status to IGNORED, and sends no email", async () => {
    m(prisma.memory.update).mockResolvedValue({ ...mockMemory, status: "IGNORED" });

    const res = await POST(makeRequest({ action: "ignore" }), makeParams());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("IGNORED");
    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  // --- Happy path: return ---

  it("returns a memory, sets status to RETURNED, and emails the submitter", async () => {
    const returnMessage = "Please add more details about the event.";
    m(prisma.memory.update).mockResolvedValue({
      ...mockMemory,
      status: "RETURNED",
      returnMessage,
    });

    const res = await POST(
      makeRequest({ action: "return", returnMessage }),
      makeParams()
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("RETURNED");
    expect(data.returnMessage).toBe(returnMessage);
    expect(vi.mocked(sendNotification)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "bob@example.com" })
    );
  });

  it("trims the returnMessage before storing", async () => {
    m(prisma.memory.update).mockResolvedValue({
      ...mockMemory,
      status: "RETURNED",
      returnMessage: "Please revise.",
    });

    const res = await POST(
      makeRequest({ action: "return", returnMessage: "  Please revise.  " }),
      makeParams()
    );

    expect(res.status).toBe(200);
    // Verify prisma.memory.update was called with the trimmed message
    expect(m(prisma.memory.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ returnMessage: "Please revise." }),
      })
    );
  });
});
