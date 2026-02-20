import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "./s3";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_TYPES.includes(contentType);
}

export function getExtFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return ext;
}

export async function generateUploadUrl(
  s3Key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 }); // 10 minutes
}

export async function generateViewUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });
  await s3.send(command);
}

export function buildImageS3Key(
  memorialId: string,
  imageId: string,
  ext: string
): string {
  return `memorials/${memorialId}/images/${imageId}.${ext}`;
}

export function buildMemorialPictureS3Key(
  memorialId: string,
  ext: string
): string {
  return `memorials/${memorialId}/memorial-picture.${ext}`;
}

export function buildMemoryImageS3Key(
  memorialId: string,
  memoryId: string,
  imageId: string,
  ext: string
): string {
  return `memorials/${memorialId}/memories/${memoryId}/${imageId}.${ext}`;
}

/** Derive the thumbnail variant key from a base s3Key. */
export function thumbKeyFromBase(s3Key: string): string {
  const dotIdx = s3Key.lastIndexOf(".");
  if (dotIdx === -1) return `${s3Key}_thumb.webp`;
  return `${s3Key.slice(0, dotIdx)}_thumb.webp`;
}

/** Derive the full-size variant key from a base s3Key. */
export function fullKeyFromBase(s3Key: string): string {
  const dotIdx = s3Key.lastIndexOf(".");
  if (dotIdx === -1) return `${s3Key}_full.webp`;
  return `${s3Key.slice(0, dotIdx)}_full.webp`;
}
