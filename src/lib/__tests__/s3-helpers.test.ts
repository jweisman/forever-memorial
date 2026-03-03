import { describe, it, expect } from "vitest";
import {
  isAllowedImageType,
  isVideoType,
  isAllowedMediaType,
  getExtFromFileName,
  thumbKeyFromBase,
  fullKeyFromBase,
  buildImageS3Key,
  buildMemorialPictureS3Key,
  buildMemoryImageS3Key,
} from "@/lib/s3-helpers";

describe("isAllowedImageType", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "returns true for %s",
    (type) => expect(isAllowedImageType(type)).toBe(true)
  );

  it.each(["video/mp4", "image/bmp", "application/pdf", ""])(
    "returns false for %s",
    (type) => expect(isAllowedImageType(type)).toBe(false)
  );
});

describe("isVideoType", () => {
  it.each(["video/mp4", "video/webm", "video/quicktime"])(
    "returns true for %s",
    (type) => expect(isVideoType(type)).toBe(true)
  );

  it.each(["image/jpeg", "video/avi", "application/octet-stream", ""])(
    "returns false for %s",
    (type) => expect(isVideoType(type)).toBe(false)
  );
});

describe("isAllowedMediaType", () => {
  it("returns true for all allowed image types", () => {
    expect(isAllowedMediaType("image/jpeg")).toBe(true);
    expect(isAllowedMediaType("image/gif")).toBe(true);
  });

  it("returns true for all allowed video types", () => {
    expect(isAllowedMediaType("video/mp4")).toBe(true);
    expect(isAllowedMediaType("video/quicktime")).toBe(true);
  });

  it("returns false for disallowed types", () => {
    expect(isAllowedMediaType("image/bmp")).toBe(false);
    expect(isAllowedMediaType("video/avi")).toBe(false);
    expect(isAllowedMediaType("")).toBe(false);
  });
});

describe("getExtFromFileName", () => {
  it.each([
    ["photo.jpg", "jpg"],
    ["photo.jpeg", "jpeg"],
    ["image.png", "png"],
    ["animation.gif", "gif"],
    ["clip.mp4", "mp4"],
    ["clip.webm", "webm"],
    ["clip.mov", "mov"],
    ["photo.webp", "webp"],
  ])("extracts '%s' → '%s'", (fileName, ext) => {
    expect(getExtFromFileName(fileName)).toBe(ext);
  });

  it("lowercases the extension", () => {
    expect(getExtFromFileName("photo.JPG")).toBe("jpg");
    expect(getExtFromFileName("photo.PNG")).toBe("png");
  });

  it("returns the default fallback for a disallowed extension", () => {
    expect(getExtFromFileName("doc.pdf")).toBe("jpg");
    expect(getExtFromFileName("archive.zip")).toBe("jpg");
  });

  it("uses a custom fallback when provided", () => {
    expect(getExtFromFileName("doc.pdf", "png")).toBe("png");
  });

  it("returns fallback when filename has no dot", () => {
    expect(getExtFromFileName("nodotfile")).toBe("jpg");
  });

  it("handles multiple dots — uses the last segment", () => {
    expect(getExtFromFileName("my.photo.2024.jpg")).toBe("jpg");
  });
});

describe("thumbKeyFromBase", () => {
  it("replaces the extension with _thumb.webp", () => {
    expect(thumbKeyFromBase("memorials/abc/images/xyz.jpg")).toBe(
      "memorials/abc/images/xyz_thumb.webp"
    );
  });

  it("works with any extension", () => {
    expect(thumbKeyFromBase("memorials/abc/images/xyz.png")).toBe(
      "memorials/abc/images/xyz_thumb.webp"
    );
  });

  it("uses last dot when path has multiple dots", () => {
    expect(thumbKeyFromBase("some.path/file.jpg")).toBe(
      "some.path/file_thumb.webp"
    );
  });

  it("appends _thumb.webp when no extension present", () => {
    expect(thumbKeyFromBase("memorials/abc/images/xyz")).toBe(
      "memorials/abc/images/xyz_thumb.webp"
    );
  });
});

describe("fullKeyFromBase", () => {
  it("replaces the extension with _full.webp", () => {
    expect(fullKeyFromBase("memorials/abc/images/xyz.jpg")).toBe(
      "memorials/abc/images/xyz_full.webp"
    );
  });

  it("works with any extension", () => {
    expect(fullKeyFromBase("memorials/abc/images/xyz.webp")).toBe(
      "memorials/abc/images/xyz_full.webp"
    );
  });

  it("uses last dot when path has multiple dots", () => {
    expect(fullKeyFromBase("some.path/file.png")).toBe(
      "some.path/file_full.webp"
    );
  });

  it("appends _full.webp when no extension present", () => {
    expect(fullKeyFromBase("memorials/abc/images/xyz")).toBe(
      "memorials/abc/images/xyz_full.webp"
    );
  });
});

describe("buildImageS3Key", () => {
  it("builds the correct S3 key path", () => {
    expect(buildImageS3Key("mem1", "img1", "jpg")).toBe(
      "memorials/mem1/images/img1.jpg"
    );
  });
});

describe("buildMemorialPictureS3Key", () => {
  it("builds the correct S3 key path", () => {
    expect(buildMemorialPictureS3Key("mem1", "webp")).toBe(
      "memorials/mem1/memorial-picture.webp"
    );
  });
});

describe("buildMemoryImageS3Key", () => {
  it("builds the correct S3 key path", () => {
    expect(buildMemoryImageS3Key("mem1", "mry1", "img1", "jpg")).toBe(
      "memorials/mem1/memories/mry1/img1.jpg"
    );
  });
});
