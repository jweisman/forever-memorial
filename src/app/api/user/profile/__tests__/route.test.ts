import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));

import { PATCH } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const mockUser = {
  id: USER_ID,
  name: "Jane Doe",
  email: "jane@example.com",
};

function makePatchRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/user/profile
// ---------------------------------------------------------------------------

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(USER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.user.update).mockResolvedValue(mockUser);
  });

  // --- Auth & guards ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PATCH(makePatchRequest({ name: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await PATCH(makePatchRequest({ name: "New Name" }));
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 400 when name exceeds 100 characters", async () => {
    const res = await PATCH(makePatchRequest({ name: "a".repeat(101) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/100/);
  });

  // --- Happy path ---

  it("returns 200 with updated user data", async () => {
    const res = await PATCH(makePatchRequest({ name: "Jane Doe" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(USER_ID);
    expect(data.name).toBe("Jane Doe");
  });

  it("updates the user's name in the DB", async () => {
    await PATCH(makePatchRequest({ name: "  Jane Smith  " }));
    expect(m(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { name: "Jane Smith" },
      })
    );
  });

  it("sets name to null when name is an empty string", async () => {
    await PATCH(makePatchRequest({ name: "" }));
    expect(m(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: null },
      })
    );
  });

  it("sets name to null when name is blank whitespace", async () => {
    await PATCH(makePatchRequest({ name: "   " }));
    expect(m(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: null },
      })
    );
  });

  it("sets name to null when name is not provided", async () => {
    await PATCH(makePatchRequest({}));
    expect(m(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: null },
      })
    );
  });

  it("returns only id, name, and email fields", async () => {
    const res = await PATCH(makePatchRequest({ name: "Jane Doe" }));
    const data = await res.json();
    expect(Object.keys(data)).toEqual(expect.arrayContaining(["id", "name", "email"]));
  });
});
