import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    memorialLink: { delete: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));

import { DELETE } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const LINK_ID = "link-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

function makeDeleteRequest() {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/links/${LINK_ID}`,
    { method: "DELETE" }
  );
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID, linkId: LINK_ID }) };
}

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------

describe("DELETE /api/memorials/[id]/links/[linkId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.memorialLink.delete).mockResolvedValue({});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 with success: true when owner deletes", async () => {
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("deletes the correct link scoped to the memorial", async () => {
    await DELETE(makeDeleteRequest(), makeParams());
    expect(m(prisma.memorialLink.delete)).toHaveBeenCalledWith({
      where: { id: LINK_ID, memorialId: MEMORIAL_ID },
    });
  });
});
