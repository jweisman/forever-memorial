import { vi, describe, it, expect, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    memorial: { findUnique: vi.fn() },
    album: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    image: { count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/admin", () => ({ isUserDisabled: vi.fn() }));
vi.mock("@/lib/s3-helpers", () => ({
  isVideoType: vi.fn().mockImplementation((t: string) =>
    ["video/mp4", "video/webm", "video/quicktime"].includes(t)
  ),
  getExtFromFileName: vi.fn().mockReturnValue("mp4"),
  buildImageS3Key: vi.fn().mockReturnValue("memorials/mem-001/images/vid-001.mp4"),
  createMultipartUpload: vi.fn().mockResolvedValue("upload-id-123"),
  generatePartUploadUrl: vi.fn().mockResolvedValue("https://s3.example.com/part-url"),
  completeMultipartUpload: vi.fn().mockResolvedValue(undefined),
  abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
  generateViewUrl: vi.fn().mockResolvedValue("https://s3.example.com/view"),
  MULTIPART_PART_SIZE: 10 * 1024 * 1024,
}));

import { POST as StartPOST } from "../route";
import { POST as CompletePOST } from "../complete/route";
import { POST as AbortPOST } from "../abort/route";
import {
  isVideoType,
  getExtFromFileName,
  buildImageS3Key,
  createMultipartUpload,
  generatePartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  generateViewUrl,
} from "@/lib/s3-helpers";

const OWNER_ID = "owner-001";
const MEMORIAL_ID = "mem-001";
const ALBUM_ID = "album-001";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function makeSession(userId: string) {
  return { user: { id: userId } };
}

function makeParams() {
  return { params: Promise.resolve({ id: MEMORIAL_ID }) };
}

function makeRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/multipart-upload (start)
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/multipart-upload", () => {
  const validBody = {
    fileName: "video.mp4",
    contentType: "video/mp4",
    fileSize: 100 * 1024 * 1024, // 100 MB
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(isVideoType).mockImplementation((t: string) =>
      ["video/mp4", "video/webm", "video/quicktime"].includes(t)
    );
    vi.mocked(getExtFromFileName).mockReturnValue("mp4");
    vi.mocked(buildImageS3Key).mockReturnValue("memorials/mem-001/images/vid-001.mp4");
    vi.mocked(createMultipartUpload).mockResolvedValue("upload-id-123");
    vi.mocked(generatePartUploadUrl).mockResolvedValue("https://s3.example.com/part-url");
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.image.count).mockResolvedValue(0);
    m(prisma.album.findFirst).mockResolvedValue({ id: ALBUM_ID });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is disabled", async () => {
    vi.mocked(isUserDisabled).mockResolvedValue(true);
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when memorial not found", async () => {
    m(prisma.memorial.findUnique).mockResolvedValue(null);
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not memorial owner", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("other-user") as never);
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for non-video content type", async () => {
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", {
        ...validBody,
        contentType: "image/jpeg",
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when fileSize is missing", async () => {
    const { fileSize: _, ...noSize } = validBody;
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", noSize),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 500MB", async () => {
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", {
        ...validBody,
        fileSize: 501 * 1024 * 1024,
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/500MB/);
  });

  it("returns 400 when 100-image limit reached", async () => {
    m(prisma.image.count).mockResolvedValue(100);
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/100/);
  });

  it("returns uploadId, parts, and s3Key on success", async () => {
    const res = await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploadId).toBe("upload-id-123");
    expect(data.mediaType).toBe("VIDEO");
    expect(data.parts.length).toBe(10); // 100MB / 10MB = 10 parts
    expect(data.parts[0].partNumber).toBe(1);
    expect(data.parts[0].url).toBe("https://s3.example.com/part-url");
  });

  it("creates default Photos album when no albumId provided", async () => {
    await StartPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload", validBody),
      makeParams()
    );
    expect(m(prisma.album.findFirst)).toHaveBeenCalledWith({
      where: { memorialId: MEMORIAL_ID, name: "Photos" },
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/multipart-upload/complete
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/multipart-upload/complete", () => {
  const validBody = {
    uploadId: "upload-id-123",
    s3Key: "memorials/mem-001/images/vid-001.mp4",
    imageId: "vid-001",
    albumId: ALBUM_ID,
    parts: [{ partNumber: 1, etag: '"abc"' }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(completeMultipartUpload).mockResolvedValue(undefined);
    vi.mocked(generateViewUrl).mockResolvedValue("https://s3.example.com/view");
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID });
    m(prisma.album.findUnique).mockResolvedValue({ memorialId: MEMORIAL_ID });
    m(prisma.image.count).mockResolvedValue(0);
    m(prisma.image.aggregate).mockResolvedValue({ _max: { order: null } });
    m(prisma.image.create).mockResolvedValue({
      id: "vid-001",
      albumId: ALBUM_ID,
      s3Key: validBody.s3Key,
      caption: null,
      order: 0,
      mediaType: "VIDEO",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await CompletePOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/complete", validBody),
      makeParams()
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    const res = await CompletePOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/complete", { uploadId: "x" }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid s3Key", async () => {
    const res = await CompletePOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/complete", {
        ...validBody,
        s3Key: "memorials/WRONG/images/vid-001.mp4",
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/s3Key/i);
  });

  it("returns 201 and creates DB record on success", async () => {
    const res = await CompletePOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/complete", validBody),
      makeParams()
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("vid-001");
    expect(data.thumbUrl).toBe("https://s3.example.com/view");
    expect(vi.mocked(completeMultipartUpload)).toHaveBeenCalledWith(
      validBody.s3Key,
      validBody.uploadId,
      validBody.parts
    );
  });

  it("returns 400 when 100-image limit reached", async () => {
    m(prisma.image.count).mockResolvedValue(100);
    const res = await CompletePOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/complete", validBody),
      makeParams()
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/memorials/[id]/multipart-upload/abort
// ---------------------------------------------------------------------------

describe("POST /api/memorials/[id]/multipart-upload/abort", () => {
  const validBody = {
    uploadId: "upload-id-123",
    s3Key: "memorials/mem-001/images/vid-001.mp4",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession(OWNER_ID) as never);
    vi.mocked(isUserDisabled).mockResolvedValue(false);
    vi.mocked(abortMultipartUpload).mockResolvedValue(undefined);
    m(prisma.memorial.findUnique).mockResolvedValue({ ownerId: OWNER_ID  });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await AbortPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/abort", validBody),
      makeParams()
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when uploadId or s3Key is missing", async () => {
    const res = await AbortPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/abort", { uploadId: "x" }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid s3Key prefix", async () => {
    const res = await AbortPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/abort", {
        uploadId: "x",
        s3Key: "memorials/WRONG/images/vid-001.mp4",
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("calls abortMultipartUpload and returns ok on success", async () => {
    const res = await AbortPOST(
      makeRequest("/api/memorials/mem-001/multipart-upload/abort", validBody),
      makeParams()
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(vi.mocked(abortMultipartUpload)).toHaveBeenCalledWith(
      validBody.s3Key,
      validBody.uploadId
    );
  });
});
