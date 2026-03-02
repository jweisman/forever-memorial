import { resizeImage, resizeImageSquare } from "./image-resize";


const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_MAX_SIZE = 15 * 1024 * 1024; // 15MB (original before resize)
const VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return "Image must be 15MB or smaller.";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return "Only MP4, WebM, and MOV videos are allowed.";
  }
  if (file.size > VIDEO_MAX_SIZE) {
    return "Video must be 50MB or smaller.";
  }
  return null;
}

export function isVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.includes(file.type);
}

async function uploadBlobToS3(
  blob: Blob,
  presignedUrl: string,
  contentType?: string
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType ?? "image/webp" },
  });
  if (!res.ok) throw new Error("Upload to S3 failed");
}

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
};

export async function uploadImage(
  memorialId: string,
  file: File,
  options?: { albumId?: string; caption?: string }
): Promise<ImageRecord> {
  // 1. Resize client-side
  const [thumb, full] = await Promise.all([
    resizeImage(file, 400, 0.8),
    resizeImage(file, 1600, 0.85),
  ]);

  // 2. Get presigned URLs for variants
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/images/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        albumId: options?.albumId,
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, fullUploadUrl, s3Key, imageId, albumId } =
    await urlRes.json();

  // 3. Upload both variants to S3
  await Promise.all([
    uploadBlobToS3(thumb, thumbUploadUrl),
    uploadBlobToS3(full, fullUploadUrl),
  ]);

  // 4. Confirm upload
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId,
        s3Key,
        albumId,
        caption: options?.caption,
      }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}

export async function uploadVideo(
  memorialId: string,
  file: File,
  options?: { albumId?: string; caption?: string }
): Promise<ImageRecord> {
  // 1. Get a single presigned URL (no resize for video)
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/images/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        albumId: options?.albumId,
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { uploadUrl, s3Key, imageId, albumId } = await urlRes.json();

  // 2. Upload original file directly to S3
  await uploadBlobToS3(file, uploadUrl, file.type);

  // 3. Confirm upload
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId,
        s3Key,
        albumId,
        caption: options?.caption,
        mediaType: "VIDEO",
      }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}

export async function uploadMemorialPicture(
  memorialId: string,
  file: File
): Promise<string> {
  // 1. Resize to square thumbnail
  const thumb = await resizeImageSquare(file, 256, 0.8);

  // 2. Get presigned URL for thumb variant
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, thumbS3Key } = await urlRes.json();

  // 3. Upload to S3
  await uploadBlobToS3(thumb, thumbUploadUrl);

  // 4. Confirm
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key: thumbS3Key }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  const data = await confirmRes.json();
  return data.url;
}

/**
 * Upload a pre-cropped blob as the memorial picture (skips resizeImageSquare).
 * Used after the interactive crop UI.
 */
export async function uploadMemorialPictureBlob(
  memorialId: string,
  blob: Blob
): Promise<string> {
  // 1. Get presigned URL
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "memorial-picture.webp",
        contentType: "image/webp",
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, thumbS3Key } = await urlRes.json();

  // 2. Upload blob to S3
  await uploadBlobToS3(blob, thumbUploadUrl);

  // 3. Confirm
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key: thumbS3Key }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  const data = await confirmRes.json();
  return data.url;
}

type MemoryImageRecord = {
  id: string;
  s3Key: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
};

export async function uploadMemoryImage(
  memorialId: string,
  memoryId: string,
  file: File
): Promise<MemoryImageRecord> {
  // 1. Resize client-side
  const [thumb, full] = await Promise.all([
    resizeImage(file, 400, 0.8),
    resizeImage(file, 1600, 0.85),
  ]);

  // 2. Get presigned URLs for variants
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, fullUploadUrl, s3Key, imageId } =
    await urlRes.json();

  // 3. Upload both variants to S3
  await Promise.all([
    uploadBlobToS3(thumb, thumbUploadUrl),
    uploadBlobToS3(full, fullUploadUrl),
  ]);

  // 4. Confirm
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, s3Key }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}

export async function uploadMemoryVideo(
  memorialId: string,
  memoryId: string,
  file: File
): Promise<MemoryImageRecord> {
  // 1. Get a single presigned URL (no resize for video)
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { uploadUrl, s3Key, imageId } = await urlRes.json();

  // 2. Upload original file directly to S3
  await uploadBlobToS3(file, uploadUrl, file.type);

  // 3. Confirm
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, s3Key, mediaType: "VIDEO" }),
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}
