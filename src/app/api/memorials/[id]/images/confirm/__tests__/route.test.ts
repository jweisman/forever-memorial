import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    album: { findUnique: vi.fn() },
    image: { count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/s3-helpers", () => ({
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  thumbKeyFromBase: vi.fn().mockImplementation((k: string) => `${k}_thumb`),
  fullKeyFromBase: vi.fn().mockImplementation((k: string) => `${k}_full`),
}));

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = "owner-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const ALBUM_ID = "album-001";
const IMAGE_ID = "image-001";
const S3_KEY = "memorials/memorial-001/images/image-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const validBody = {
  imageId: IMAGE_ID,
  s3Key: S3_KEY,
  albumId: ALBUM_ID,
};

const mockImage = {
  id: IMAGE_ID,
  albumId: ALBUM_ID,
  s3Key: S3_KEY,
  caption: null,
  order: 0,
  mediaType: "IMAGE",
};

function makePostRequest(body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/memorials/${MEMORIAL_ID}/images/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/images/confirm
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/images/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) => `${k}_thumb`);
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) => `${k}_full`);
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.album.findUnique).mockResolvedValue({ memorialId: MEMORIAL_ID });
    m(prisma.image.count).mockResolvedValue(0);
    m(prisma.image.aggregate).mockResolvedValue({ _max: { order: null } });
    m(prisma.image.create).mockResolvedValue(mockImage);
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

  it("returns 400 when imageId is missing", async () => {
    const res = await POST(
      makePostRequest({ s3Key: S3_KEY, albumId: ALBUM_ID }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/imageId/);
  });

  it("returns 400 when s3Key is missing", async () => {
    const res = await POST(
      makePostRequest({ imageId: IMAGE_ID, albumId: ALBUM_ID }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when albumId is missing", async () => {
    const res = await POST(
      makePostRequest({ imageId: IMAGE_ID, s3Key: S3_KEY }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  // --- Business logic ---

  it("returns 404 when album does not belong to this memorial", async () => {
    m(prisma.album.findUnique).mockResolvedValue({ memorialId: "other-memorial" });
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/album not found/i);
  });

  it("returns 404 when album does not exist", async () => {
    m(prisma.album.findUnique).mockResolvedValue(null);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when the 100-image limit is reached", async () => {
    m(prisma.image.count).mockResolvedValue(100);
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/100/);
  });

  // --- Happy path: IMAGE ---

  it("returns 201 with image and presigned URLs for IMAGE type", async () => {
    const res = await POST(makePostRequest(validBody), makeParams());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(IMAGE_ID);
    expect(data.thumbUrl).toBe("https://s3.example.com/view");
    expect(data.url).toBe("https://s3.example.com/view");
    expect(vi.mocked(thumbKeyFromBase)).toHaveBeenCalledWith(S3_KEY);
    expect(vi.mocked(fullKeyFromBase)).toHaveBeenCalledWith(S3_KEY);
  });

  it("assigns order 0 when no images exist in the album yet", async () => {
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.image.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 0 }),
      })
    );
  });

  it("assigns order as max+1", async () => {
    m(prisma.image.aggregate).mockResolvedValue({ _max: { order: 4 } });
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.image.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 5 }),
      })
    );
  });

  // --- Happy path: VIDEO ---

  it("returns 201 with the same URL for thumb and full for VIDEO type", async () => {
    m(prisma.image.create).mockResolvedValue({ ...mockImage, mediaType: "VIDEO" });
    const res = await POST(
      makePostRequest({ ...validBody, mediaType: "VIDEO" }),
      makeParams()
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.thumbUrl).toBe("https://s3.example.com/view");
    expect(data.url).toBe("https://s3.example.com/view");
    // Should NOT derive thumb/full keys for video
    expect(vi.mocked(thumbKeyFromBase)).not.toHaveBeenCalled();
    expect(vi.mocked(fullKeyFromBase)).not.toHaveBeenCalled();
  });

  it("saves mediaType IMAGE by default when mediaType is not provided", async () => {
    await POST(makePostRequest(validBody), makeParams());
    expect(m(prisma.image.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mediaType: "IMAGE" }),
      })
    );
  });

  it("saves caption when provided", async () => {
    await POST(makePostRequest({ ...validBody, caption: "  Summer 1990  " }), makeParams());
    expect(m(prisma.image.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caption: "Summer 1990" }),
      })
    );
  });
});
