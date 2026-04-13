import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    eulogy: { findUnique: vi.fn() },
    eulogyImage: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/s3-helpers", () => ({
  isAllowedMediaType: vi.fn(),
  isVideoType: vi.fn(),
  getExtFromFileName: vi.fn(),
  generateUploadUrl: vi.fn(),
  generateViewUrl: vi.fn(),
  buildEulogyImageS3Key: vi.fn(),
  thumbKeyFromBase: vi.fn(),
  fullKeyFromBase: vi.fn(),
  deleteS3Object: vi.fn(),
}));

import { POST as UploadUrlPOST } from "../upload-url/route";
import { POST as ConfirmPOST } from "../confirm/route";
import { DELETE } from "../[imageId]/route";
import {
  isAllowedMediaType,
  isVideoType,
  getExtFromFileName,
  generateUploadUrl,
  generateViewUrl,
  buildEulogyImageS3Key,
  thumbKeyFromBase,
  fullKeyFromBase,
  deleteS3Object,
} from "@/lib/s3-helpers";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const OWNER_ID = "owner-001";
const OTHER_ID = "other-001";
const MEMORIAL_ID = "memorial-001";
const EULOGY_ID = "eulogy-001";
const IMAGE_ID = "image-001";

function makeSession(userId: string) {
  return { user: { id: userId } };
}

const mockEulogy = {
  id: EULOGY_ID,
  memorialId: MEMORIAL_ID,
  memorial: { ownerId: OWNER_ID },
};

function makeUploadUrlRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeUploadUrlParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID, eulogyId: EULOGY_ID }) };
}

function makeDeleteParams(imageId = IMAGE_ID) {
  return { params: Promise.resolve({ id: MEMORIAL_ID, eulogyId: EULOGY_ID, imageId }) };
}

// ---------------------------------------------------------------------------
// POST /upload-url
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/eulogies/[eulogyId]/images/upload-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.eulogy.findUnique).mockResolvedValue(mockEulogy);
    m(prisma.eulogyImage.count).mockResolvedValue(0);
    vi.mocked(isAllowedMediaType).mockReturnValue(true);
    vi.mocked(isVideoType).mockReturnValue(false);
    vi.mocked(getExtFromFileName).mockReturnValue("jpg");
    vi.mocked(buildEulogyImageS3Key).mockReturnValue("memorials/m/eulogies/e/img.jpg");
    vi.mocked(generateUploadUrl).mockResolvedValue("https://s3/upload");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when eulogy not found", async () => {
    m(prisma.eulogy.findUnique).mockResolvedValue(null);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when contentType is invalid", async () => {
    vi.mocked(isAllowedMediaType).mockReturnValue(false);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "application/pdf" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when image limit reached", async () => {
    m(prisma.eulogyImage.count).mockResolvedValue(5);
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns presigned URLs for image upload", async () => {
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "image/jpeg", fileName: "photo.jpg" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.thumbUploadUrl).toBeDefined();
    expect(data.fullUploadUrl).toBeDefined();
    expect(data.s3Key).toBeDefined();
    expect(data.imageId).toBeDefined();
    expect(data.mediaType).toBe("IMAGE");
  });

  it("returns single upload URL for video", async () => {
    vi.mocked(isVideoType).mockReturnValue(true);
    vi.mocked(getExtFromFileName).mockReturnValue("mp4");
    const res = await UploadUrlPOST(
      makeUploadUrlRequest({ contentType: "video/mp4", fileName: "clip.mp4" }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploadUrl).toBeDefined();
    expect(data.mediaType).toBe("VIDEO");
  });
});

// ---------------------------------------------------------------------------
// POST /confirm
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/eulogies/[eulogyId]/images/confirm", () => {
  const validBody = {
    imageId: IMAGE_ID,
    s3Key: `memorials/${MEMORIAL_ID}/eulogies/${EULOGY_ID}/img.jpg`,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.eulogy.findUnique).mockResolvedValue(mockEulogy);
    m(prisma.eulogyImage.count).mockResolvedValue(0);
    m(prisma.eulogyImage.create).mockResolvedValue({
      id: IMAGE_ID,
      eulogyId: EULOGY_ID,
      s3Key: validBody.s3Key,
      mediaType: "IMAGE",
    });
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3/view");
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) => `${k}_thumb`);
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) => `${k}_full`);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await ConfirmPOST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when s3Key is invalid", async () => {
    const res = await ConfirmPOST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, s3Key: "wrong/path/img.jpg" }),
      }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with created image record", async () => {
    const res = await ConfirmPOST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(IMAGE_ID);
    expect(data.thumbUrl).toBeDefined();
    expect(data.url).toBeDefined();
  });

  it("returns 400 when image limit reached", async () => {
    m(prisma.eulogyImage.count).mockResolvedValue(5);
    const res = await ConfirmPOST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      makeUploadUrlParams()
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /[imageId]
// ---------------------------------------------------------------------------

describe("DELETE /api/memorials/[id]/eulogies/[eulogyId]/images/[imageId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    m(prisma.eulogy.findUnique).mockResolvedValue(mockEulogy);
    m(prisma.eulogyImage.findUnique).mockResolvedValue({
      id: IMAGE_ID,
      eulogyId: EULOGY_ID,
      s3Key: "memorials/m/eulogies/e/img.jpg",
      mediaType: "IMAGE",
    });
    m(prisma.eulogyImage.delete).mockResolvedValue({});
    vi.mocked(deleteS3Object).mockResolvedValue(undefined);
    vi.mocked(thumbKeyFromBase).mockImplementation((k: string) => `${k}_thumb`);
    vi.mocked(fullKeyFromBase).mockImplementation((k: string) => `${k}_full`);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeDeleteParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession(OTHER_ID) as never);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeDeleteParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when image not found", async () => {
    m(prisma.eulogyImage.findUnique).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeDeleteParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 and deletes S3 objects for IMAGE", async () => {
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeDeleteParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledTimes(2); // thumb + full
    expect(m(prisma.eulogyImage.delete)).toHaveBeenCalledWith({ where: { id: IMAGE_ID } });
  });

  it("deletes single S3 object for VIDEO", async () => {
    m(prisma.eulogyImage.findUnique).mockResolvedValue({
      id: IMAGE_ID,
      eulogyId: EULOGY_ID,
      s3Key: "memorials/m/eulogies/e/vid.mp4",
      mediaType: "VIDEO",
    });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeDeleteParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteS3Object)).toHaveBeenCalledTimes(1);
  });
});
