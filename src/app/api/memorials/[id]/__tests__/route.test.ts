import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { buildSlug } from "@/lib/slug";
import { generateViewUrl } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/slug", () => ({
  buildSlug: vi.fn().mockReturnValue("memorial-001-jane-doe"),
}));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
}));

import { GET, PATCH, DELETE } from "../route";

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

const mockMemorial = {
  id: MEMORIAL_ID,
  ownerId: OWNER_ID,
  name: "Jane Doe",
  slug: "memorial-001-jane-doe",
  disabled: false,
  memorialPicture: null,
  eulogies: [],
  owner: { id: OWNER_ID, name: "Jane Doe Owner" },
};

function makeGetRequest() {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}`);
}

function makePatchRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}`, {
    method: "DELETE",
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    m(prisma.memorial.findUnique).mockResolvedValue(mockMemorial);
  });

  it("returns 404 when memorial is not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when memorial is disabled", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({ ...mockMemorial, disabled: true });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with memorial data when found and enabled", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(MEMORIAL_ID);
    expect(data.name).toBe("Jane Doe");
  });

  it("resolves memorialPicture to a presigned URL when present", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue({
      ...mockMemorial,
      memorialPicture: "memorials/memorial-001/picture_full.webp",
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.memorialPicture).toBe("https://s3.example.com/view");
  });

  it("returns null memorialPicture when not set", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    const data = await res.json();
    expect(data.memorialPicture).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PATCH tests
// ---------------------------------------------------------------------------

describe("PATCH /api/memorials/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(buildSlug).mockReturnValue("memorial-001-jane-doe");
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID, name: "Jane Doe" });
    m(prisma.memorial.update).mockResolvedValue(mockMemorial);
  });

  // --- Auth & guard ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await PATCH(makePatchRequest({ name: "New Name" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await PATCH(makePatchRequest({ name: "New Name" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: "New Name" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await PATCH(makePatchRequest({ name: "New Name" }), makeParams());
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 400 when name is an empty string", async () => {
    const res = await PATCH(makePatchRequest({ name: "" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const res = await PATCH(makePatchRequest({ name: "   " }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 200 characters", async () => {
    const res = await PATCH(makePatchRequest({ name: "a".repeat(201) }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/200/);
  });

  it("returns 400 when dateOfDeath is an invalid date string", async () => {
    const res = await PATCH(makePatchRequest({ dateOfDeath: "not-a-date" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/date of death/i);
  });

  it("returns 400 when birthday is an invalid date string", async () => {
    const res = await PATCH(makePatchRequest({ birthday: "not-a-date" }), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/birthday/i);
  });

  // --- Happy path ---

  it("returns 200 on a valid PATCH", async () => {
    const res = await PATCH(makePatchRequest({ lifeStory: "A great life." }), makeParams());
    expect(res.status).toBe(200);
  });

  it("regenerates the slug when name is changed", async () => {
    await PATCH(makePatchRequest({ name: "Jane Smith" }), makeParams());
    expect(vi.mocked(buildSlug)).toHaveBeenCalledWith(MEMORIAL_ID, "Jane Smith");
    expect(m(prisma.memorial.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "memorial-001-jane-doe" }),
      })
    );
  });

  it("sets deathAfterSunset to true when provided", async () => {
    await PATCH(makePatchRequest({ deathAfterSunset: true }), makeParams());
    expect(m(prisma.memorial.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deathAfterSunset: true }),
      })
    );
  });

  it("sets birthday to null when birthday is falsy", async () => {
    await PATCH(makePatchRequest({ birthday: "" }), makeParams());
    expect(m(prisma.memorial.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthday: null }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------

describe("DELETE /api/memorials/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.memorial.delete).mockResolvedValue({});
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

  it("returns 403 when user is not the memorial owner", async () => {
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
});
