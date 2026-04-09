import { resizeImage, resizeImageSquare } from "./image-resize";


const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_MAX_SIZE = 15 * 1024 * 1024; // 15MB (original before resize)
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB — use multipart above this
const MAX_CONCURRENT_PARTS = 4;

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
    return "Video must be 500MB or smaller.";
  }
  return null;
}

export function isVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.includes(file.type);
}

// ---------------------------------------------------------------------------
// Upload primitives with progress support
// ---------------------------------------------------------------------------

export type UploadProgressCallback = (progress: number) => void;

/** Upload a blob to a presigned URL with optional progress tracking via XHR. */
function uploadBlobWithProgress(
  blob: Blob,
  presignedUrl: string,
  contentType: string,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload cancelled", "AbortError"));
      });
    }

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Upload to S3 failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload to S3 failed"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    xhr.send(blob);
  });
}

/** Upload a blob without progress (simple fetch, used for small image variants). */
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

// ---------------------------------------------------------------------------
// Multipart upload orchestration (client-side)
// ---------------------------------------------------------------------------

type MultipartStartResponse = {
  uploadId: string;
  s3Key: string;
  imageId: string;
  albumId?: string;
  mediaType: "VIDEO";
  partSize: number;
  parts: { partNumber: number; url: string }[];
};

/**
 * Upload a large video using S3 multipart upload.
 * Uploads parts concurrently (up to MAX_CONCURRENT_PARTS) with aggregate progress.
 */
/**
 * Upload a large video using S3 multipart upload.
 * Uploads parts concurrently (up to MAX_CONCURRENT_PARTS) with aggregate progress.
 * Returns the start data + completed parts for the caller to finalize via the complete endpoint.
 */
async function uploadMultipartParts(
  file: File,
  startUrl: string,
  abortUrl: string,
  startBody: Record<string, unknown>,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<MultipartStartResponse & { completedParts: { partNumber: number; etag: string }[] }> {
  // 1. Initiate multipart upload
  const startRes = await fetch(startUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(startBody),
    signal,
  });
  if (!startRes.ok) {
    const err = await startRes.json();
    throw new Error(err.error || "Failed to initiate multipart upload");
  }
  const startData: MultipartStartResponse = await startRes.json();
  const { uploadId, s3Key, partSize, parts } = startData;

  // Track per-part progress for aggregate calculation
  const partProgress = new Float64Array(parts.length);
  const totalSize = file.size;

  function reportProgress() {
    if (!onProgress) return;
    let loaded = 0;
    for (let i = 0; i < parts.length; i++) {
      const partStart = i * partSize;
      const partEnd = Math.min(partStart + partSize, totalSize);
      loaded += partProgress[i] * (partEnd - partStart);
    }
    onProgress(loaded / totalSize);
  }

  // 2. Upload parts with concurrency control
  const completedParts: { partNumber: number; etag: string }[] = [];

  async function uploadPart(partInfo: { partNumber: number; url: string }, index: number) {
    const start = index * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunk = file.slice(start, end);

    const etag = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (signal) {
        signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new DOMException("Upload cancelled", "AbortError"));
        });
      }

      xhr.open("PUT", partInfo.url);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            partProgress[index] = e.loaded / e.total;
            reportProgress();
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etagHeader = xhr.getResponseHeader("ETag");
          if (!etagHeader) {
            reject(new Error(`Part ${partInfo.partNumber}: missing ETag`));
          } else {
            resolve(etagHeader);
          }
        } else {
          reject(new Error(`Part ${partInfo.partNumber} upload failed`));
        }
      };

      xhr.onerror = () => reject(new Error(`Part ${partInfo.partNumber} upload failed`));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

      xhr.send(chunk);
    });

    return { partNumber: partInfo.partNumber, etag };
  }

  try {
    // Upload parts with concurrency limit
    const queue = [...parts.entries()];
    const active: Promise<void>[] = [];

    for (const [index, partInfo] of queue) {
      const promise = uploadPart(partInfo, index).then((result) => {
        completedParts.push(result);
      });

      active.push(promise);

      if (active.length >= MAX_CONCURRENT_PARTS) {
        await Promise.race(active);
        // Remove settled promises
        for (let i = active.length - 1; i >= 0; i--) {
          const settled = await Promise.race([
            active[i].then(() => true),
            Promise.resolve(false),
          ]);
          if (settled) active.splice(i, 1);
        }
      }
    }

    await Promise.all(active);
  } catch (err) {
    // Abort the multipart upload on failure
    try {
      await fetch(abortUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, s3Key }),
      });
    } catch {
      // Ignore abort errors
    }
    throw err;
  }

  // Sort parts by part number before completing
  completedParts.sort((a, b) => a.partNumber - b.partNumber);

  return { ...startData, completedParts };
}

// ---------------------------------------------------------------------------
// Public upload functions
// ---------------------------------------------------------------------------

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
};

type UploadOptions = {
  albumId?: string;
  caption?: string;
  onProgress?: UploadProgressCallback;
  signal?: AbortSignal;
};

export async function uploadImage(
  memorialId: string,
  file: File,
  options?: UploadOptions
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
      signal: options?.signal,
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, fullUploadUrl, s3Key, imageId, albumId } =
    await urlRes.json();

  // 3. Upload both variants to S3 with progress
  const thumbSize = thumb.size;
  const fullSize = full.size;
  const totalSize = thumbSize + fullSize;

  let thumbLoaded = 0;
  let fullLoaded = 0;

  await Promise.all([
    uploadBlobWithProgress(thumb, thumbUploadUrl, "image/webp", (p) => {
      thumbLoaded = p * thumbSize;
      options?.onProgress?.((thumbLoaded + fullLoaded) / totalSize);
    }, options?.signal),
    uploadBlobWithProgress(full, fullUploadUrl, "image/webp", (p) => {
      fullLoaded = p * fullSize;
      options?.onProgress?.((thumbLoaded + fullLoaded) / totalSize);
    }, options?.signal),
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
      signal: options?.signal,
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
  options?: UploadOptions
): Promise<ImageRecord> {
  // Use multipart for large videos
  if (file.size > MULTIPART_THRESHOLD) {
    return uploadVideoMultipart(memorialId, file, options);
  }

  // Small video: single presigned PUT
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
      signal: options?.signal,
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { uploadUrl, s3Key, imageId, albumId } = await urlRes.json();

  await uploadBlobWithProgress(file, uploadUrl, file.type, options?.onProgress, options?.signal);

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
      signal: options?.signal,
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}

async function uploadVideoMultipart(
  memorialId: string,
  file: File,
  options?: UploadOptions
): Promise<ImageRecord> {
  const uploaded = await uploadMultipartParts(
    file,
    `/api/memorials/${memorialId}/multipart-upload`,
    `/api/memorials/${memorialId}/multipart-upload/abort`,
    {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      albumId: options?.albumId,
    },
    options?.onProgress,
    options?.signal
  );

  const res = await fetch(
    `/api/memorials/${memorialId}/multipart-upload/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: uploaded.uploadId,
        s3Key: uploaded.s3Key,
        imageId: uploaded.imageId,
        albumId: uploaded.albumId,
        caption: options?.caption,
        parts: uploaded.completedParts,
      }),
      signal: options?.signal,
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to complete upload");
  }
  return res.json();
}

export async function uploadMemorialPicture(
  memorialId: string,
  file: File
): Promise<string> {
  // 1. Resize to thumbnail (square 256) and full (1600px width)
  const [thumb, full] = await Promise.all([
    resizeImageSquare(file, 256, 0.8),
    resizeImage(file, 1600, 0.85),
  ]);

  // 2. Get presigned URLs for both variants
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
  const { thumbUploadUrl, fullUploadUrl, s3Key } = await urlRes.json();

  // 3. Upload both variants to S3
  await Promise.all([
    uploadBlobToS3(thumb, thumbUploadUrl),
    uploadBlobToS3(full, fullUploadUrl),
  ]);

  // 4. Confirm with base key
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key }),
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
 * Upload a pre-cropped blob as the memorial picture.
 * Used after the interactive crop UI. Creates both thumbnail and full variants.
 */
export async function uploadMemorialPictureBlob(
  memorialId: string,
  blob: Blob
): Promise<string> {
  // 1. Resize the cropped blob into thumb + full variants
  const file = new File([blob], "memorial-picture.webp", { type: "image/webp" });
  const [thumb, full] = await Promise.all([
    resizeImageSquare(file, 256, 0.8),
    resizeImage(file, 1600, 0.85),
  ]);

  // 2. Get presigned URLs for both variants
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
  const { thumbUploadUrl, fullUploadUrl, s3Key } = await urlRes.json();

  // 3. Upload both variants to S3
  await Promise.all([
    uploadBlobToS3(thumb, thumbUploadUrl),
    uploadBlobToS3(full, fullUploadUrl),
  ]);

  // 4. Confirm with base key
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memorial-picture/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key }),
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

type MemoryUploadOptions = {
  onProgress?: UploadProgressCallback;
  signal?: AbortSignal;
};

export async function uploadMemoryImage(
  memorialId: string,
  memoryId: string,
  file: File,
  options?: MemoryUploadOptions
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
      signal: options?.signal,
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { thumbUploadUrl, fullUploadUrl, s3Key, imageId } =
    await urlRes.json();

  // 3. Upload both variants with progress
  const thumbSize = thumb.size;
  const fullSize = full.size;
  const totalSize = thumbSize + fullSize;

  let thumbLoaded = 0;
  let fullLoaded = 0;

  await Promise.all([
    uploadBlobWithProgress(thumb, thumbUploadUrl, "image/webp", (p) => {
      thumbLoaded = p * thumbSize;
      options?.onProgress?.((thumbLoaded + fullLoaded) / totalSize);
    }, options?.signal),
    uploadBlobWithProgress(full, fullUploadUrl, "image/webp", (p) => {
      fullLoaded = p * fullSize;
      options?.onProgress?.((thumbLoaded + fullLoaded) / totalSize);
    }, options?.signal),
  ]);

  // 4. Confirm
  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, s3Key }),
      signal: options?.signal,
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
  file: File,
  options?: MemoryUploadOptions
): Promise<MemoryImageRecord> {
  // Use multipart for large videos
  if (file.size > MULTIPART_THRESHOLD) {
    return uploadMemoryVideoMultipart(memorialId, memoryId, file, options);
  }

  // Small video: single presigned PUT
  const urlRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
      }),
      signal: options?.signal,
    }
  );
  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || "Failed to get upload URL");
  }
  const { uploadUrl, s3Key, imageId } = await urlRes.json();

  await uploadBlobWithProgress(file, uploadUrl, file.type, options?.onProgress, options?.signal);

  const confirmRes = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/images/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, s3Key, mediaType: "VIDEO" }),
      signal: options?.signal,
    }
  );
  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || "Failed to confirm upload");
  }
  return confirmRes.json();
}

async function uploadMemoryVideoMultipart(
  memorialId: string,
  memoryId: string,
  file: File,
  options?: MemoryUploadOptions
): Promise<MemoryImageRecord> {
  const uploaded = await uploadMultipartParts(
    file,
    `/api/memorials/${memorialId}/memories/${memoryId}/multipart-upload`,
    `/api/memorials/${memorialId}/memories/${memoryId}/multipart-upload/abort`,
    {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    },
    options?.onProgress,
    options?.signal
  );

  const res = await fetch(
    `/api/memorials/${memorialId}/memories/${memoryId}/multipart-upload/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: uploaded.uploadId,
        s3Key: uploaded.s3Key,
        imageId: uploaded.imageId,
        parts: uploaded.completedParts,
      }),
      signal: options?.signal,
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to complete upload");
  }
  return res.json();
}
