import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    memory: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/s3-helpers", () => ({
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
  thumbKeyFromBase: vi.fn((k: string) => `${k}_thumb`),
  fullKeyFromBase: vi.fn((k: string) => `${k}_full`),
}));

import { GET as getMemorials } from "../memorials/route";
import { PATCH as toggleMemorial } from "../memorials/[id]/toggle/route";
import { GET as getUsers } from "../users/route";
import { PATCH as toggleUser } from "../users/[id]/toggle/route";
import { DELETE as deleteMemory } from "../memories/[memoryId]/route";
import { GET as getMemorialMemories } from "../memorials/[id]/memories/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ID = "admin-001";
const TARGET_USER_ID = "user-001";
const MEMORIAL_ID = "memorial-001";
const MEMORY_ID = "memory-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeAdminOk() {
  return { session: { user: { id: ADMIN_ID } } };
}

function makeAdminError(status: 401 | 403) {
  return {
    error: NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Forbidden" },
      { status }
    ),
  };
}

function makeRequest(method = "GET") {
  return new Request("http://localhost/api/admin", { method });
}

function makeMemorialParams(id = MEMORIAL_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeUserParams(id = TARGET_USER_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeMemoryParams(memoryId = MEMORY_ID) {
  return { params: Promise.resolve({ memoryId }) };
}

// ---------------------------------------------------------------------------
// GET /admin/memorials
// ---------------------------------------------------------------------------

describe("GET /api/admin/memorials", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.memorial.findMany).mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await getMemorials();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await getMemorials();
    expect(res.status).toBe(403);
  });

  it("returns 200 with list of memorials", async () => {
    const mockList = [{ id: MEMORIAL_ID, name: "Jane Doe", disabled: false }];
    m(prisma.memorial.findMany).mockResolvedValue(mockList);
    const res = await getMemorials();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(MEMORIAL_ID);
  });
});

// ---------------------------------------------------------------------------
// PATCH /admin/memorials/[id]/toggle
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/memorials/[id]/toggle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.memorial.findUnique).mockResolvedValue({ disabled: false });
    m(prisma.memorial.update).mockResolvedValue({ id: MEMORIAL_ID, disabled: true });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await toggleMemorial(makeRequest("PATCH"), makeMemorialParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await toggleMemorial(makeRequest("PATCH"), makeMemorialParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await toggleMemorial(makeRequest("PATCH"), makeMemorialParams());
    expect(res.status).toBe(404);
  });

  it("toggles disabled and returns new state", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({ disabled: false });
    m(prisma.memorial.update).mockResolvedValue({ id: MEMORIAL_ID, disabled: true });
    const res = await toggleMemorial(makeRequest("PATCH"), makeMemorialParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.disabled).toBe(true);
    expect(m(prisma.memorial.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { disabled: true } })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.user.findMany).mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await getUsers();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await getUsers();
    expect(res.status).toBe(403);
  });

  it("returns 200 with list of users", async () => {
    const mockList = [{ id: TARGET_USER_ID, email: "user@example.com", disabled: false }];
    m(prisma.user.findMany).mockResolvedValue(mockList);
    const res = await getUsers();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(TARGET_USER_ID);
  });
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/[id]/toggle
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/users/[id]/toggle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.user.findUnique).mockResolvedValue({ disabled: false });
    m(prisma.user.update).mockResolvedValue({ id: TARGET_USER_ID, disabled: true });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await toggleUser(makeRequest("PATCH"), makeUserParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await toggleUser(makeRequest("PATCH"), makeUserParams());
    expect(res.status).toBe(403);
  });

  it("returns 400 when admin tries to disable themselves", async () => {
    // Target user id matches the admin's own id
    const res = await toggleUser(makeRequest("PATCH"), makeUserParams(ADMIN_ID));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/yourself/i);
  });

  it("returns 404 when user not found", async () => {
    m(prisma.user.findUnique).mockResolvedValue(null);
    const res = await toggleUser(makeRequest("PATCH"), makeUserParams());
    expect(res.status).toBe(404);
  });

  it("toggles user disabled and returns new state", async () => {
    m(prisma.user.findUnique).mockResolvedValue({ disabled: false });
    m(prisma.user.update).mockResolvedValue({ id: TARGET_USER_ID, disabled: true });
    const res = await toggleUser(makeRequest("PATCH"), makeUserParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /admin/memories/[memoryId]
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/memories/[memoryId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.memory.findUnique).mockResolvedValue({ id: MEMORY_ID, images: [] });
    m(prisma.memory.delete).mockResolvedValue({});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await deleteMemory(makeRequest("DELETE"), makeMemoryParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await deleteMemory(makeRequest("DELETE"), makeMemoryParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memory not found", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(null);
    const res = await deleteMemory(makeRequest("DELETE"), makeMemoryParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with success: true after deletion", async () => {
    const res = await deleteMemory(makeRequest("DELETE"), makeMemoryParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("attempts S3 deletion for each image's thumb and full variants", async () => {
    const { deleteS3Object } = await import("@/lib/s3-helpers");
    m(prisma.memory.findUnique).mockResolvedValue({
      id: MEMORY_ID,
      images: [{ s3Key: "memories/memory-001/img.webp" }],
    });
    await deleteMemory(makeRequest("DELETE"), makeMemoryParams());
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledWith(
      "memories/memory-001/img.webp_thumb"
    );
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledWith(
      "memories/memory-001/img.webp_full"
    );
  });
});

// ---------------------------------------------------------------------------
// GET /admin/memorials/[id]/memories
// ---------------------------------------------------------------------------

describe("GET /api/admin/memorials/[id]/memories", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminOk() as never);
    m(prisma.memory.findMany).mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(401) as never);
    const res = await getMemorialMemories(makeRequest(), makeMemorialParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(makeAdminError(403) as never);
    const res = await getMemorialMemories(makeRequest(), makeMemorialParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 with accepted memories for the memorial", async () => {
    const mockMemories = [{ id: MEMORY_ID, name: "Bob", text: "A great person." }];
    m(prisma.memory.findMany).mockResolvedValue(mockMemories);
    const res = await getMemorialMemories(makeRequest(), makeMemorialParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(MEMORY_ID);
    // Only ACCEPTED memories should be fetched
    expect(m(prisma.memory.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
  });
});
