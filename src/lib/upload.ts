const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > MAX_SIZE) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

export async function uploadImageToS3(
  file: File,
  presignedUrl: string
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error("Upload to S3 failed");
}

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  url: string;
};

export async function uploadImage(
  memorialId: string,
  file: File,
  options?: { albumId?: string; caption?: string }
): Promise<ImageRecord> {
  // 1. Get presigned URL
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

  // 2. Upload directly to S3/MinIO
  await uploadImageToS3(file, uploadUrl);

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
  // 1. Get presigned URL
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
  const { uploadUrl, s3Key } = await urlRes.json();

  // 2. Upload to S3
  await uploadImageToS3(file, uploadUrl);

  // 3. Confirm
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
  url: string;
};

export async function uploadMemoryImage(
  memorialId: string,
  memoryId: string,
  file: File
): Promise<MemoryImageRecord> {
  // 1. Get presigned URL
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

  // 2. Upload to S3
  await uploadImageToS3(file, uploadUrl);

  // 3. Confirm
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
