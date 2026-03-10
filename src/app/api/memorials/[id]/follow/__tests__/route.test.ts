import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    memorialFollow: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

import { POST, DELETE } from "../route";

const USER_ID = "user-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(id: string) {
  return { user: { id } };
}

function makeRequest(method = "POST") {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/follow`, { method });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession(USER_ID) as never);
  vi.mocked(isUserDisabled).mockResolvedValue(false);
  m(rateLimit).mockReturnValue({ success: true });
  m(prisma.memorial.findUnique).mockResolvedValue({ id: MEMORIAL_ID });
  m(prisma.memorialFollow.upsert).mockResolvedValue({});
  m(prisma.memorialFollow.deleteMany).mockResolvedValue({ count: 1 });
});

describe("POST /api/memorials/[id]/follow", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    m(rateLimit).mockReturnValue({ success: false });
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("upserts follow and returns following: true", async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ following: true });
    expect(m(prisma.memorialFollow.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_memorialId: { userId: USER_ID, memorialId: MEMORIAL_ID } },
      })
    );
  });

  it("is idempotent — upsert called even when already following", async () => {
    await POST(makeRequest(), makeParams());
    await POST(makeRequest(), makeParams());
    expect(m(prisma.memorialFollow.upsert)).toHaveBeenCalledTimes(2);
  });
});

describe("DELETE /api/memorials/[id]/follow", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    m(rateLimit).mockReturnValue({ success: false });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(429);
  });

  it("deletes follow and returns following: false", async () => {
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ following: false });
    expect(m(prisma.memorialFollow.deleteMany)).toHaveBeenCalledWith({
      where: { userId: USER_ID, memorialId: MEMORIAL_ID },
    });
  });

  it("succeeds gracefully when not following (deleteMany count 0)", async () => {
    m(prisma.memorialFollow.deleteMany).mockResolvedValue({ count: 0 });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ following: false });
  });
});
