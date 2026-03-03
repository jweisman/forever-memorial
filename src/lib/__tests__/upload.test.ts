import { describe, it, expect } from "vitest";
import { validateImageFile, validateVideoFile, isVideoFile } from "@/lib/upload";

// Node 20+ has File built-in; construct minimal File objects for testing
function makeFile(name: string, type: string, sizeBytes: number): File {
  // File constructor: new File(parts, name, options)
  // Using an empty array for parts and specifying size via a Blob workaround
  // isn't possible directly, so we create a real Blob of the right size.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

const MB = 1024 * 1024;

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
  it("returns null for a valid MP4 under 50MB", () => {
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

  it("returns an error string when file exceeds 50MB", () => {
    const file = makeFile("big.mp4", "video/mp4", 51 * MB);
    expect(validateVideoFile(file)).toMatch(/50MB/i);
  });

  it("returns null for a file exactly at the 50MB limit", () => {
    const file = makeFile("clip.mp4", "video/mp4", 50 * MB);
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
