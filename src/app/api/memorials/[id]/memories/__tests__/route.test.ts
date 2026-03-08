import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { sendNotification } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    memory: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendNotification: vi.fn(),
  newSubmissionEmail: vi.fn().mockReturnValue({ subject: "new memory", html: "<p>new</p>" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((fn: () => void) => fn()) };
});
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  thumbKeyFromBase: vi.fn((k: string) => k.replace(/\.[^.]+$/, "_thumb.webp")),
  fullKeyFromBase: vi.fn((k: string) => k.replace(/\.[^.]+$/, "_full.webp")),
}));

import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = "user-001";
const OWNER_ID = "owner-001";
const MEMORIAL_ID = "memorial-001";
const MEMORY_ID = "memory-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId = USER_ID) {
  return { user: { id: userId } };
}

const mockMemorial = {
  id: MEMORIAL_ID,
  disabled: false,
  name: "Jane Doe",
  owner: { email: "owner@example.com" },
};

const mockCreatedMemory = {
  id: MEMORY_ID,
  memorialId: MEMORIAL_ID,
  submitterId: USER_ID,
  name: "Alice",
  text: "She was kind.",
  withholdName: false,
  relation: null,
  status: "PENDING",
};

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

const validBody = { name: "Alice", text: "She was kind." };

const mockAcceptedMemory = {
  id: MEMORY_ID,
  memorialId: MEMORIAL_ID,
  submitterId: USER_ID,
  name: "Alice",
  text: "She was kind.",
  withholdName: false,
  status: "ACCEPTED",
  images: [],
};

function makeGetRequest(query?: string) {
  return new Request(
    `http://localhost/api/memorials/${MEMORIAL_ID}/memories${query ? `?${query}` : ""}`
  );
}

// ---------------------------------------------------------------------------
// GET tests — public path (no ?status=)
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/memories — public path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_thumb.webp")
    );
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_full.webp")
    );
    m(prisma.memory.findMany).mockResolvedValue([mockAcceptedMemory]);
  });

  it("returns accepted memories without authentication", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(MEMORY_ID);
  });

  it("replaces name with 'Anonymous' when withholdName is true", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      { ...mockAcceptedMemory, name: "Real Name", withholdName: true },
    ]);
    const res = await GET(makeGetRequest(), makeParams());
    const data = await res.json();
    expect(data[0].name).toBe("Anonymous");
  });

  it("preserves name when withholdName is false", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    const data = await res.json();
    expect(data[0].name).toBe("Alice");
  });

  it("resolves IMAGE presigned URLs for thumb and full", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      {
        ...mockAcceptedMemory,
        images: [{ id: "img-1", s3Key: "key/image.jpg", mediaType: "IMAGE" }],
      },
    ]);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
    expect(vi.mocked(thumbKeyFromBase)).toHaveBeenCalledWith("key/image.jpg");
    expect(vi.mocked(fullKeyFromBase)).toHaveBeenCalledWith("key/image.jpg");
  });

  it("uses a single presigned URL for both thumbUrl and url on VIDEO images", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      {
        ...mockAcceptedMemory,
        images: [{ id: "vid-1", s3Key: "key/video.mp4", mediaType: "VIDEO" }],
      },
    ]);
    const res = await GET(makeGetRequest(), makeParams());
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
  });
});

// ---------------------------------------------------------------------------
// GET tests — owner path (?status=)
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/memories — owner path (?status=)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: OWNER_ID } } as never);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_thumb.webp")
    );
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) =>
      k.replace(/\.[^.]+$/, "_full.webp")
    );
    m(prisma.memorial.findUnique).mockResolvedValue({
      ownerId: OWNER_ID,
      name: "Jane Doe",
      slug: "jane-doe",
    });
    m(prisma.memory.findMany).mockResolvedValue([]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(makeGetRequest("status=PENDING"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest("status=PENDING"), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: USER_ID } } as never);
    const res = await GET(makeGetRequest("status=PENDING"), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns memories filtered by status with memorial info attached", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      { ...mockAcceptedMemory, status: "PENDING", images: [] },
    ]);
    const res = await GET(makeGetRequest("status=PENDING"), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].memorial).toEqual({ name: "Jane Doe", slug: "jane-doe" });
  });

  it("passes multiple statuses to findMany", async () => {
    await GET(makeGetRequest("status=PENDING,RETURNED"), makeParams());
    expect(m(prisma.memory.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PENDING", "RETURNED"] },
        }),
      })
    );
  });

  it("resolves IMAGE presigned URLs for thumb and full in authenticated path", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      {
        ...mockAcceptedMemory,
        images: [{ id: "img-1", s3Key: "key/image.jpg", mediaType: "IMAGE" }],
      },
    ]);
    const res = await GET(makeGetRequest("status=ACCEPTED"), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
  });

  it("uses a single presigned URL for VIDEO images in authenticated path", async () => {
    m(prisma.memory.findMany).mockResolvedValue([
      {
        ...mockAcceptedMemory,
        images: [{ id: "vid-1", s3Key: "key/video.mp4", mediaType: "VIDEO" }],
      },
    ]);
    const res = await GET(makeGetRequest("status=ACCEPTED"), makeParams());
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
  });
});

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/memories", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession() as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 9 });
    m(prisma.memorial.findUnique).mockResolvedValue(mockMemorial);
    m(prisma.memory.create).mockResolvedValue(mockCreatedMemory);
  });

  // --- Auth & guard ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockReturnValue({ success: false, remaining: 0 });
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(429);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when memorial is disabled", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({ ...mockMemorial, disabled: true });
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/disabled/i);
  });

  // --- Input validation ---

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ text: "Some text" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const res = await POST(makeRequest({ name: "   ", text: "Some text" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 200 characters", async () => {
    const res = await POST(
      makeRequest({ name: "a".repeat(201), text: "Some text" }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/200/);
  });

  it("returns 400 when text is missing", async () => {
    const res = await POST(makeRequest({ name: "Alice" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/text/i);
  });

  it("returns 400 when text exceeds 50,000 characters", async () => {
    const res = await POST(
      makeRequest({ name: "Alice", text: "a".repeat(50_001) }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/50.000/);
  });

  // --- Happy path ---

  it("creates a memory and returns 201 with the created record", async () => {
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(MEMORY_ID);
    expect(data.status).toBe("PENDING");
  });

  it("notifies the memorial owner by email on successful submission", async () => {
    await POST(makeRequest(validBody), makeParams());
    expect(vi.mocked(sendNotification)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com" })
    );
  });

  it("stores withholdName: true when requested", async () => {
    m(prisma.memory.create).mockResolvedValue({ ...mockCreatedMemory, withholdName: true });
    const res = await POST(
      makeRequest({ ...validBody, withholdName: true }),
      makeParams()
    );
    expect(res.status).toBe(201);
    expect(m(prisma.memory.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ withholdName: true }),
      })
    );
  });

  it("does not send email when owner has no email address", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({
      ...mockMemorial,
      owner: { email: null },
    });
    const res = await POST(makeRequest(validBody), makeParams());
    expect(res.status).toBe(201);
    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  it("trims leading/trailing whitespace from name and text", async () => {
    await POST(
      makeRequest({ name: "  Alice  ", text: "  She was kind.  " }),
      makeParams()
    );
    expect(m(prisma.memory.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Alice", text: "She was kind." }),
      })
    );
  });
});
