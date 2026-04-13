import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    eulogy: { findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn(),
  thumbKeyFromBase: vi.fn(),
  fullKeyFromBase: vi.fn(),
}));

import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const mockEulogy = {
  id: "eulogy-001",
  memorialId: MEMORIAL_ID,
  text: "She was a wonderful person.",
  deliveredBy: "John Smith",
  relation: "Son",
  order: 0,
  images: [],
};

function makePostRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/eulogies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

// ---------------------------------------------------------------------------
// GET /api/memorials/[id]/eulogies
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/eulogies", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m(prisma.eulogy.findMany).mockResolvedValue([mockEulogy]);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3/signed-url");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) => `${k}_thumb`);
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) => `${k}_full`);
  });

  it("returns 200 with eulogies (no auth required)", async () => {
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("eulogy-001");
  });

  it("queries by memorialId ordered by order asc with images", async () => {
    await GET(new Request("http://localhost"), makeParams());
    expect(m(prisma.eulogy.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memorialId: MEMORIAL_ID },
        orderBy: { order: "asc" },
        include: { images: true },
      })
    );
  });

  it("returns an empty array when there are no eulogies", async () => {
    m(prisma.eulogy.findMany).mockResolvedValue([]);
    const res = await GET(new Request("http://localhost"), makeParams());
    const data = await res.json();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/eulogies
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/eulogies", () => {
  const validBody = {
    text: "She was a wonderful person.",
    deliveredBy: "John Smith",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.eulogy.aggregate).mockResolvedValue({ _max: { order: 2 } });
    m(prisma.eulogy.create).mockResolvedValue({ ...mockEulogy, order: 3 });
  });

  // --- Auth & guards ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 400 when text is missing", async () => {
    const res = await POST(makePostRequest({ deliveredBy: "John Smith" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/text/i);
  });

  it("returns 400 when text is blank whitespace", async () => {
    const res = await POST(makePostRequest({ text: "   ", deliveredBy: "John Smith" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when deliveredBy is missing", async () => {
    const res = await POST(
      makePostRequest({ text: "She was wonderful." }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/delivered by/i);
  });

  // --- Happy path ---

  it("returns 201 with the created eulogy", async () => {
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("eulogy-001");
    expect(data.text).toBe("She was a wonderful person.");
  });

  it("assigns order as max+1", async () => {
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.eulogy.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 3 }),
      })
    );
  });

  it("assigns order 0 when no eulogies exist yet", async () => {
    m(prisma.eulogy.aggregate).mockResolvedValue({ _max: { order: null } });
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.eulogy.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      })
    );
  });

  it("includes optional relation when provided", async () => {
    await POST(makePostRequest({ ...validBody, relation: "Son" }), makeParams());
    expect(m(prisma.eulogy.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relation: "Son" }),
      })
    );
  });

  it("sets relation to null when not provided", async () => {
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.eulogy.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relation: null }),
      })
    );
  });
});
