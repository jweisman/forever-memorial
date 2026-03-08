import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { buildSlug } from "@/lib/slug";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/slug", () => ({ buildSlug: vi.fn().mockReturnValue("cuid-jane-doe") }));

import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const MEMORIAL_ID = "memorial-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const mockMemorial = {
  id: MEMORIAL_ID,
  slug: "cuid-jane-doe",
  ownerId: OWNER_ID,
  name: "Jane Doe",
  dateOfDeath: new Date("2023-01-15"),
  birthday: null,
  placeOfDeath: null,
  memorialPicture: null,
  createdAt: new Date(),
};

function makePostRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/memorials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET /api/memorials
// ---------------------------------------------------------------------------

describe("GET /api/memorials", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    m(prisma.memorial.findMany).mockResolvedValue([mockMemorial]);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with the user's memorials", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(MEMORIAL_ID);
  });

  it("queries only the authenticated user's non-disabled memorials", async () => {
    await GET();
    expect(m(prisma.memorial.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: OWNER_ID, disabled: false },
      })
    );
  });

  it("returns an empty array when user has no memorials", async () => {
    m(prisma.memorial.findMany).mockResolvedValue([]);
    const res = await GET();
    const data = await res.json();
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/memorials
// ---------------------------------------------------------------------------

describe("POST /api/memorials", () => {
  const validBody = {
    name: "Jane Doe",
    dateOfDeath: "2023-01-15",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(buildSlug).mockReturnValue("cuid-jane-doe");
    m(prisma.memorial.create).mockResolvedValue({ ...mockMemorial, slug: "temp-123" });
    m(prisma.memorial.update).mockResolvedValue(mockMemorial);
  });

  // --- Auth & guards ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePostRequest({ dateOfDeath: "2023-01-15" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const res = await POST(makePostRequest({ name: "   ", dateOfDeath: "2023-01-15" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 200 characters", async () => {
    const res = await POST(makePostRequest({ name: "a".repeat(201), dateOfDeath: "2023-01-15" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/200/);
  });

  it("returns 400 when dateOfDeath is missing", async () => {
    const res = await POST(makePostRequest({ name: "Jane Doe" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/date of death/i);
  });

  it("returns 400 when dateOfDeath is an invalid date", async () => {
    const res = await POST(makePostRequest({ name: "Jane Doe", dateOfDeath: "not-a-date" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid date of death/i);
  });

  it("returns 400 when birthday is an invalid date", async () => {
    const res = await POST(
      makePostRequest({ name: "Jane Doe", dateOfDeath: "2023-01-15", birthday: "bad" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid birthday/i);
  });

  // --- Happy path ---

  it("returns 201 with the created memorial", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(MEMORIAL_ID);
    expect(data.slug).toBe("cuid-jane-doe");
  });

  it("creates with a temp slug then updates to the real slug", async () => {
    await POST(makePostRequest(validBody));
    expect(m(prisma.memorial.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: expect.stringMatching(/^temp-/) }),
      })
    );
    expect(vi.mocked(buildSlug)).toHaveBeenCalledWith(MEMORIAL_ID, "Jane Doe");
    expect(m(prisma.memorial.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMORIAL_ID },
        data: { slug: "cuid-jane-doe" },
      })
    );
  });

  it("sets deathAfterSunset when provided", async () => {
    await POST(makePostRequest({ ...validBody, deathAfterSunset: true }));
    expect(m(prisma.memorial.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deathAfterSunset: true }),
      })
    );
  });

  it("sets birthday when provided", async () => {
    await POST(makePostRequest({ ...validBody, birthday: "1950-06-10" }));
    expect(m(prisma.memorial.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthday: new Date("1950-06-10") }),
      })
    );
  });

  it("sets optional text fields when provided", async () => {
    await POST(
      makePostRequest({
        ...validBody,
        placeOfDeath: "  New York  ",
        lifeStory: "A great life.",
      })
    );
    expect(m(prisma.memorial.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placeOfDeath: "New York",
          lifeStory: "A great life.",
        }),
      })
    );
  });
});
