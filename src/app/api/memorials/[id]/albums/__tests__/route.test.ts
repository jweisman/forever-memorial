import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    album: { findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  thumbKeyFromBase: vi.fn().mockImplementation((k: string) => `${k}_thumb`),
  fullKeyFromBase: vi.fn().mockImplementation((k: string) => `${k}_full`),
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

const mockAlbumEmpty = {
  id: "album-001",
  memorialId: MEMORIAL_ID,
  name: "Childhood",
  order: 0,
  images: [],
  _count: { images: 0 },
};

const mockImageBase = {
  id: "image-001",
  albumId: "album-001",
  s3Key: "memorials/memorial-001/images/image-001",
  caption: null,
  order: 0,
  mediaType: "IMAGE",
};

function makePostRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/albums`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

// ---------------------------------------------------------------------------
// GET /api/memorials/[id]/albums
// ---------------------------------------------------------------------------

describe("GET /api/memorials/[id]/albums", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) => `${k}_thumb`);
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) => `${k}_full`);
    m(prisma.album.findMany).mockResolvedValue([mockAlbumEmpty]);
  });

  it("returns 200 with albums (no auth required)", async () => {
    const res = await GET(new Request("http://localhost"), makeParams());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("album-001");
  });

  it("returns an empty array when there are no albums", async () => {
    m(prisma.album.findMany).mockResolvedValue([]);
    const res = await GET(new Request("http://localhost"), makeParams());
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("resolves presigned URLs for IMAGE type images", async () => {
    m(prisma.album.findMany).mockResolvedValue([
      { ...mockAlbumEmpty, images: [{ ...mockImageBase, mediaType: "IMAGE" }] },
    ]);
    const res = await GET(new Request("http://localhost"), makeParams());
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
    expect(vi.mocked(thumbKeyFromBase)).toHaveBeenCalled();
    expect(vi.mocked(fullKeyFromBase)).toHaveBeenCalled();
  });

  it("uses the same URL for thumb and full for VIDEO type images", async () => {
    m(prisma.album.findMany).mockResolvedValue([
      { ...mockAlbumEmpty, images: [{ ...mockImageBase, mediaType: "VIDEO" }] },
    ]);
    const res = await GET(new Request("http://localhost"), makeParams());
    const data = await res.json();
    expect(data[0].images[0].thumbUrl).toBe("https://s3.example.com/view");
    expect(data[0].images[0].url).toBe("https://s3.example.com/view");
    // Should NOT derive thumb/full keys for video
    expect(vi.mocked(thumbKeyFromBase)).not.toHaveBeenCalled();
    expect(vi.mocked(fullKeyFromBase)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/albums
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/albums", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.album.aggregate).mockResolvedValue({ _max: { order: 1 } });
    m(prisma.album.create).mockResolvedValue({ ...mockAlbumEmpty, order: 2 });
  });

  // --- Auth & guards ---

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(res.status).toBe(403);
  });

  // --- Input validation ---

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/album name/i);
  });

  it("returns 400 when name is blank whitespace", async () => {
    const res = await POST(makePostRequest({ name: "   " }), makeParams());
    expect(res.status).toBe(400);
  });

  // --- Happy path ---

  it("returns 201 with the created album", async () => {
    const res = await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("album-001");
  });

  it("assigns order as max+1", async () => {
    await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(m(prisma.album.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 2 }),
      })
    );
  });

  it("assigns order 0 when no albums exist yet", async () => {
    m(prisma.album.aggregate).mockResolvedValue({ _max: { order: null } });
    await POST(makePostRequest({ name: "Childhood" }), makeParams());
    expect(m(prisma.album.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      })
    );
  });
});
