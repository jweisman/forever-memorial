import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { sendNotification } from "@/lib/email";
import { deleteS3Object, generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memory: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendNotification: vi.fn(),
  memoryResubmittedEmail: vi.fn().mockReturnValue({ subject: "resubmit", html: "<p>resubmit</p>" }),
}));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  deleteS3Object: vi.fn().mockResolvedValue(undefined),
  thumbKeyFromBase: vi.fn((k: string) => k.replace(/\.[^.]+$/, "_thumb.webp")),
  fullKeyFromBase: vi.fn((k: string) => k.replace(/\.[^.]+$/, "_full.webp")),
}));

import { GET, PATCH, DELETE } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const SUBMITTER_ID = "submitter-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const MEMORY_ID = "memory-001";

// Shorthand cast for vi.fn()-backed prisma methods
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

// Memory with memorial relation included (for PATCH)
function makeMemory(overrides?: Record<string, unknown>) {
  return {
    id: MEMORY_ID,
    memorialId: MEMORIAL_ID,
    submitterId: SUBMITTER_ID,
    name: "Bob Smith",
    text: "A wonderful person",
    status: "PENDING",
    returnMessage: null,
    images: [],
    memorial: {
      ownerId: OWNER_ID,
      name: "Jane Doe",
      owner: { email: "owner@example.com" },
    },
    ...overrides,
  };
}

function makeGetRequest() {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/memories/${MEMORY_ID}`
  );
}

function makePatchRequest(body: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/memories/${MEMORY_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeDeleteRequest() {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/memories/${MEMORY_ID}`,
    { method: "DELETE" }
  );
}

function makeParams(overrides?: Partial<{ id: string; memoryId: string }>) {
  return {
    params: Promise.resolve({ id: MEMORIAL_ID, memoryId: MEMORY_ID, ...overrides }),
  };
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/memories/[memoryId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_thumb.webp")
    );
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_full.webp")
    );
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory());
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when memory not found", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when memory belongs to a different memorial", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({ memorialId: "other-memorial" })
    );
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither owner nor submitter", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 200 for the memorial owner", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(MEMORY_ID);
  });

  it("returns 200 for the memory submitter", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it("resolves IMAGE presigned URLs via thumb and full keys", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({ images: [{ id: "img-1", s3Key: "key/image.jpg", mediaType: "IMAGE" }] })
    );
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data.images[0].url).toBe("https://s3.example.com/view");
    expect(vi.mocked(thumbKeyFromBase)).toHaveBeenCalledWith("key/image.jpg");
    expect(vi.mocked(fullKeyFromBase)).toHaveBeenCalledWith("key/image.jpg");
  });

  it("uses the same presigned URL for thumbUrl and url on VIDEO images", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({ images: [{ id: "vid-1", s3Key: "key/video.mp4", mediaType: "VIDEO" }] })
    );
    const res = await GET(makeGetRequest(), makeParams());
    const data = await res.json();
    expect(data.images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data.images[0].url).toBe("https://s3.example.com/view");
  });
});

// ---------------------------------------------------------------------------
// PATCH tests
// ---------------------------------------------------------------------------

describe("PATCH /api/memorials/[id]/memories/[memoryId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: authenticated as owner
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory());
    m(prisma.memory.update).mockResolvedValue(makeMemory());
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memory not found", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when memory belongs to a different memorial", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({ memorialId: "different-memorial" })
    );
    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when submitter tries to edit a non-RETURNED memory", async () => {
    // Authenticated as the submitter (not owner), memory is PENDING
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "PENDING" }));

    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/returned/i);
  });

  it("returns 403 when a third party (not owner or submitter) tries to edit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await PATCH(makePatchRequest({ text: "updated" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("allows the owner to edit any memory regardless of status", async () => {
    // Owner editing a PENDING memory
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "PENDING" }));
    m(prisma.memory.update).mockResolvedValue(makeMemory({ text: "updated by owner" }));

    const res = await PATCH(makePatchRequest({ text: "updated by owner" }), makeParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  it("allows submitter to edit a RETURNED memory, resets status to PENDING, and emails the owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "RETURNED" }));
    m(prisma.memory.update).mockResolvedValue(
      makeMemory({ status: "PENDING", returnMessage: null })
    );

    const res = await PATCH(makePatchRequest({ text: "revised text" }), makeParams());

    expect(res.status).toBe(200);
    // Status should be reset to PENDING
    expect(m(prisma.memory.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", returnMessage: null }),
      })
    );
    // Owner gets notified of resubmission
    expect(vi.mocked(sendNotification)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com" })
    );
  });

  it("does not send resubmission email when owner has no email", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({ status: "RETURNED", memorial: { ownerId: OWNER_ID, name: "Jane Doe", owner: { email: null } } })
    );
    m(prisma.memory.update).mockResolvedValue(makeMemory({ status: "PENDING" }));

    const res = await PATCH(makePatchRequest({ text: "revised" }), makeParams());

    expect(res.status).toBe(200);
    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  it("updates name when a non-empty string is provided", async () => {
    await PATCH(makePatchRequest({ name: "  Alice Smith  " }), makeParams());
    expect(m(prisma.memory.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Alice Smith" }),
      })
    );
  });

  it("updates relation and withholdName when provided", async () => {
    await PATCH(makePatchRequest({ relation: "Sister", withholdName: true }), makeParams());
    expect(m(prisma.memory.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relation: "Sister", withholdName: true }),
      })
    );
  });

  it("sets relation to null when an empty string is provided", async () => {
    await PATCH(makePatchRequest({ relation: "" }), makeParams());
    expect(m(prisma.memory.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relation: null }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------

describe("DELETE /api/memorials/[id]/memories/[memoryId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "ACCEPTED" }));
    m(prisma.memory.delete).mockResolvedValue(makeMemory());
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

  it("returns 404 when memory not found", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("allows the owner to delete a memory in any status", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "IGNORED" }));
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("allows the submitter to delete their own PENDING memory", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "PENDING" }));

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns 403 when submitter tries to delete an IGNORED memory", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(SUBMITTER_ID) as never);
    m(prisma.memory.findUnique).mockResolvedValue(makeMemory({ status: "IGNORED" }));

    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("deletes thumb and full S3 objects for IMAGE type before deleting the memory", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({
        status: "ACCEPTED",
        images: [{ id: "img-1", s3Key: "memorials/m1/img1.jpg", mediaType: "IMAGE" }],
      })
    );
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledWith("memorials/m1/img1_thumb.webp");
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledWith("memorials/m1/img1_full.webp");
  });

  it("deletes a single S3 object for VIDEO type before deleting the memory", async () => {
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({
        status: "ACCEPTED",
        images: [{ id: "vid-1", s3Key: "memorials/m1/vid1.mp4", mediaType: "VIDEO" }],
      })
    );
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledWith("memorials/m1/vid1.mp4");
  });

  it("does not throw when S3 deletion fails", async () => {
    vi.mocked(deleteS3Object).mockRejectedValue(new Error("S3 error"));
    m(prisma.memory.findUnique).mockResolvedValue(
      makeMemory({
        status: "ACCEPTED",
        images: [{ id: "img-1", s3Key: "memorials/m1/img1.jpg", mediaType: "IMAGE" }],
      })
    );
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
  });
});
