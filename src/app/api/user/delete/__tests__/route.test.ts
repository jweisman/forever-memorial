import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { delete: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));

import { DELETE } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

// ---------------------------------------------------------------------------
// DELETE /api/user/delete
// ---------------------------------------------------------------------------

describe("DELETE /api/user/delete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(USER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.user.delete).mockResolvedValue({ id: USER_ID });
  });

  // --- Auth & guards ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  // --- Happy path ---

  it("returns 200 with success: true", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("deletes the authenticated user by their session ID", async () => {
    await DELETE();
    expect(m(prisma.user.delete)).toHaveBeenCalledWith({
      where: { id: USER_ID },
    });
  });

  it("calls isUserDisabled before deletion", async () => {
    await DELETE();
    expect(vi.mocked(isUserDisabled)).toHaveBeenCalledWith(USER_ID);
    expect(m(prisma.user.delete)).toHaveBeenCalled();
  });
});
