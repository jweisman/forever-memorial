import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock image-resize (DOM/Canvas — not available in Node)
vi.mock("@/lib/image-resize", () => ({
  resizeImage: vi.fn().mockResolvedValue(new Blob(["resized"], { type: "image/webp" })),
  resizeImageSquare: vi.fn().mockResolvedValue(new Blob(["square"], { type: "image/webp" })),
}));

import {
  validateImageFile,
  validateVideoFile,
  isVideoFile,
  uploadImage,
  uploadVideo,
  uploadMemorialPicture,
  uploadMemorialPictureBlob,
  uploadMemoryImage,
  uploadMemoryVideo,
} from "@/lib/upload";
import { resizeImage, resizeImageSquare } from "@/lib/image-resize";

// Node 20+ has File built-in; construct minimal File objects for testing
function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// XHR mock — uploadBlobWithProgress uses XMLHttpRequest for S3 PUTs
// ---------------------------------------------------------------------------

function createMockXHRClass() {
  return class MockXHR {
    status = 200;
    readyState = 0;
    responseHeaders: Record<string, string> = {};
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
    _method = "";
    _url = "";

    open(method: string, url: string) {
      this._method = method;
      this._url = url;
    }
    setRequestHeader() {}
    getResponseHeader(name: string) {
      return this.responseHeaders[name] ?? null;
    }
    send() {
      // Simulate immediate success
      this.readyState = 4;
      this.status = 200;
      setTimeout(() => this.onload?.(), 0);
    }
    abort() {
      this.onabort?.();
    }
  };
}

function installXhrMock() {
  vi.stubGlobal("XMLHttpRequest", createMockXHRClass());
}

describe("validateImageFile", () => {
  it("returns null for a valid JPEG under 15MB", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 1 * MB);
    expect(validateImageFile(file)).toBeNull();
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "returns null for allowed type %s",
    (type) => {
      const file = makeFile("photo", type, 1 * MB);
      expect(validateImageFile(file)).toBeNull();
    }
  );

  it("returns an error string for a disallowed MIME type", () => {
    const file = makeFile("photo.bmp", "image/bmp", 1 * MB);
    expect(validateImageFile(file)).toMatch(/JPEG|PNG|WebP|GIF/i);
  });

  it("returns an error string for a video file type", () => {
    const file = makeFile("clip.mp4", "video/mp4", 1 * MB);
    expect(validateImageFile(file)).not.toBeNull();
  });

  it("returns an error string when file exceeds 15MB", () => {
    const file = makeFile("big.jpg", "image/jpeg", 16 * MB);
    expect(validateImageFile(file)).toMatch(/15MB/i);
  });

  it("returns null for a file exactly at the 15MB limit", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 15 * MB);
    expect(validateImageFile(file)).toBeNull();
  });
});

describe("validateVideoFile", () => {
  it("returns null for a valid MP4 under 500MB", () => {
    const file = makeFile("clip.mp4", "video/mp4", 10 * MB);
    expect(validateVideoFile(file)).toBeNull();
  });

  it.each(["video/mp4", "video/webm", "video/quicktime"])(
    "returns null for allowed type %s",
    (type) => {
      const file = makeFile("clip", type, 1 * MB);
      expect(validateVideoFile(file)).toBeNull();
    }
  );

  it("returns an error string for a disallowed MIME type", () => {
    const file = makeFile("clip.avi", "video/avi", 1 * MB);
    expect(validateVideoFile(file)).toMatch(/MP4|WebM|MOV/i);
  });

  it("returns an error string for an image file type", () => {
    const file = makeFile("photo.jpg", "image/jpeg", 1 * MB);
    expect(validateVideoFile(file)).not.toBeNull();
  });

  it("returns an error string when file exceeds 500MB", () => {
    const file = makeFile("big.mp4", "video/mp4", 501 * MB);
    expect(validateVideoFile(file)).toMatch(/500MB/i);
  });

  it("returns null for a file exactly at the 500MB limit", () => {
    const file = makeFile("clip.mp4", "video/mp4", 500 * MB);
    expect(validateVideoFile(file)).toBeNull();
  });
});

describe("isVideoFile", () => {
  it.each(["video/mp4", "video/webm", "video/quicktime"])(
    "returns true for video type %s",
    (type) => {
      const file = makeFile("clip", type, 1 * MB);
      expect(isVideoFile(file)).toBe(true);
    }
  );

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "returns false for image type %s",
    (type) => {
      const file = makeFile("photo", type, 1 * MB);
      expect(isVideoFile(file)).toBe(false);
    }
  );

  it("returns false for an unknown type", () => {
    const file = makeFile("file.bin", "application/octet-stream", 1 * MB);
    expect(isVideoFile(file)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Async upload functions (fetch + XHR mocked)
// ---------------------------------------------------------------------------

const MEMORIAL_ID = "mem-001";
const MEMORY_ID = "mem-memory-001";

function makeImageFile(name = "photo.jpg", type = "image/jpeg") {
  return new File(["x"], name, { type });
}

function makeFetch(responses: Array<{ ok: boolean; data: unknown }>) {
  let call = 0;
  return vi.fn().mockImplementation(async () => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return { ok: r.ok, json: async () => r.data };
  });
}

const uploadUrlImageResponse = {
  thumbUploadUrl: "https://s3.example.com/thumb-url",
  fullUploadUrl: "https://s3.example.com/full-url",
  s3Key: "memorials/mem-001/images/img-001",
  imageId: "img-001",
  albumId: "album-001",
};

const confirmImageResponse = {
  id: "img-001",
  albumId: "album-001",
  s3Key: "memorials/mem-001/images/img-001",
  caption: null,
  order: 0,
  mediaType: "IMAGE",
  thumbUrl: "https://s3.example.com/thumb",
  url: "https://s3.example.com/full",
};

describe("uploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resizeImage).mockResolvedValue(new Blob(["resized"], { type: "image/webp" }));
    installXhrMock();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("resizes to thumb and full variants then returns the confirmed record", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: uploadUrlImageResponse },  // upload-url
      { ok: true, data: confirmImageResponse },     // confirm
    ]));

    const result = await uploadImage(MEMORIAL_ID, makeImageFile(), { albumId: "album-001" });
    expect(result.id).toBe("img-001");
    expect(result.mediaType).toBe("IMAGE");
    expect(vi.mocked(resizeImage)).toHaveBeenCalledTimes(2);
  });

  it("throws when the upload-url request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: false, data: { error: "Forbidden" } },
    ]));
    await expect(uploadImage(MEMORIAL_ID, makeImageFile())).rejects.toThrow("Forbidden");
  });

  it("throws when the confirm request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: uploadUrlImageResponse },
      { ok: false, data: { error: "Limit reached" } },
    ]));
    await expect(uploadImage(MEMORIAL_ID, makeImageFile())).rejects.toThrow("Limit reached");
  });
});

describe("uploadVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installXhrMock();
  });
  afterEach(() => vi.unstubAllGlobals());

  const uploadUrlVideoResponse = {
    uploadUrl: "https://s3.example.com/video-url",
    s3Key: "memorials/mem-001/images/vid-001.mp4",
    imageId: "vid-001",
    albumId: "album-001",
  };

  const confirmVideoResponse = {
    id: "vid-001",
    albumId: "album-001",
    s3Key: "memorials/mem-001/images/vid-001.mp4",
    caption: null,
    order: 0,
    mediaType: "VIDEO",
    url: "https://s3.example.com/video",
  };

  it("does not resize and returns the confirmed record (small video, single PUT)", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: uploadUrlVideoResponse },
      { ok: true, data: confirmVideoResponse },
    ]));

    const result = await uploadVideo(MEMORIAL_ID, makeImageFile("clip.mp4", "video/mp4"));
    expect(result.id).toBe("vid-001");
    expect(result.mediaType).toBe("VIDEO");
    expect(vi.mocked(resizeImage)).not.toHaveBeenCalled();
  });

  it("throws when the upload-url request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: false, data: { error: "Server error" } }]));
    await expect(uploadVideo(MEMORIAL_ID, makeImageFile("clip.mp4", "video/mp4"))).rejects.toThrow("Server error");
  });
});

describe("uploadMemorialPicture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installXhrMock();
  });
  afterEach(() => vi.unstubAllGlobals());

  const uploadUrlPictureResponse = {
    thumbUploadUrl: "https://s3.example.com/picture-thumb-url",
    fullUploadUrl: "https://s3.example.com/picture-full-url",
    s3Key: "memorials/mem-001/memorial-picture.jpg",
    thumbS3Key: "memorials/mem-001/memorial-picture_thumb.webp",
    fullS3Key: "memorials/mem-001/memorial-picture_full.webp",
  };

  it("resizes to thumb and full and returns the confirmed URL", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: uploadUrlPictureResponse },
      { ok: true, data: {} }, // thumb S3 upload
      { ok: true, data: {} }, // full S3 upload
      { ok: true, data: { url: "https://s3.example.com/picture" } },
    ]));

    const url = await uploadMemorialPicture(MEMORIAL_ID, makeImageFile());
    expect(url).toBe("https://s3.example.com/picture");
    expect(vi.mocked(resizeImageSquare)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resizeImage)).toHaveBeenCalledTimes(1);
  });

  it("throws when the upload-url request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: false, data: { error: "Not found" } }]));
    await expect(uploadMemorialPicture(MEMORIAL_ID, makeImageFile())).rejects.toThrow("Not found");
  });
});

describe("uploadMemorialPictureBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installXhrMock();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resizes the cropped blob and returns the confirmed URL", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: { thumbUploadUrl: "https://s3.example.com/t", fullUploadUrl: "https://s3.example.com/f", s3Key: "key" } },
      { ok: true, data: {} }, // thumb S3 upload
      { ok: true, data: {} }, // full S3 upload
      { ok: true, data: { url: "https://s3.example.com/pic" } },
    ]));

    const url = await uploadMemorialPictureBlob(MEMORIAL_ID, new Blob(["img"]));
    expect(url).toBe("https://s3.example.com/pic");
    expect(vi.mocked(resizeImageSquare)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resizeImage)).toHaveBeenCalledTimes(1);
  });
});

describe("uploadMemoryImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resizeImage).mockResolvedValue(new Blob(["resized"], { type: "image/webp" }));
    installXhrMock();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resizes to thumb and full then returns the confirmed record", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: { thumbUploadUrl: "https://s3/t", fullUploadUrl: "https://s3/f", s3Key: "key", imageId: "i1" } },
      { ok: true, data: { id: "i1", s3Key: "key", caption: null, mediaType: "IMAGE", url: "https://s3/full" } },
    ]));

    const result = await uploadMemoryImage(MEMORIAL_ID, MEMORY_ID, makeImageFile());
    expect(result.id).toBe("i1");
    expect(vi.mocked(resizeImage)).toHaveBeenCalledTimes(2);
  });

  it("throws when the upload-url request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: false, data: { error: "Memory not found" } }]));
    await expect(uploadMemoryImage(MEMORIAL_ID, MEMORY_ID, makeImageFile())).rejects.toThrow("Memory not found");
  });
});

describe("uploadMemoryVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installXhrMock();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does not resize and returns the confirmed record (small video)", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: { uploadUrl: "https://s3/v", s3Key: "key", imageId: "v1" } },
      { ok: true, data: { id: "v1", s3Key: "key", caption: null, mediaType: "VIDEO", url: "https://s3/vid" } },
    ]));

    const result = await uploadMemoryVideo(MEMORIAL_ID, MEMORY_ID, makeImageFile("clip.mp4", "video/mp4"));
    expect(result.id).toBe("v1");
    expect(vi.mocked(resizeImage)).not.toHaveBeenCalled();
  });

  it("throws when the confirm request fails", async () => {
    vi.stubGlobal("fetch", makeFetch([
      { ok: true, data: { uploadUrl: "https://s3/v", s3Key: "key", imageId: "v1" } },
      { ok: false, data: { error: "Confirm failed" } },
    ]));
    await expect(uploadMemoryVideo(MEMORIAL_ID, MEMORY_ID, makeImageFile("clip.mp4", "video/mp4"))).rejects.toThrow("Confirm failed");
  });
});
