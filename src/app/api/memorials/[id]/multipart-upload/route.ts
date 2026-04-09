import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isVideoType,
  getExtFromFileName,
  buildImageS3Key,
  createMultipartUpload,
  generatePartUploadUrl,
  MULTIPART_PART_SIZE,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

/** POST — Initiate a multipart upload for a large video. */
export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, contentType, fileSize, albumId } = body;

  if (!contentType || !isVideoType(contentType)) {
    return NextResponse.json(
      { error: "Only MP4, WebM, and MOV videos are allowed" },
      { status: 400 }
    );
  }

  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
    return NextResponse.json(
      { error: "fileSize is required" },
      { status: 400 }
    );
  }

  const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
  if (fileSize > MAX_VIDEO_SIZE) {
    return NextResponse.json(
      { error: "Video must be 500MB or smaller" },
      { status: 400 }
    );
  }

  // Check 100-image limit
  const imageCount = await prisma.image.count({
    where: { album: { memorialId: id } },
  });
  if (imageCount >= 100) {
    return NextResponse.json(
      { error: "This memorial has reached the 100-image limit" },
      { status: 400 }
    );
  }

  // Resolve album
  let resolvedAlbumId = albumId;
  if (!resolvedAlbumId) {
    let defaultAlbum = await prisma.album.findFirst({
      where: { memorialId: id, name: "Photos" },
    });
    if (!defaultAlbum) {
      defaultAlbum = await prisma.album.create({
        data: { memorialId: id, name: "Photos" },
      });
    }
    resolvedAlbumId = defaultAlbum.id;
  } else {
    const album = await prisma.album.findUnique({
      where: { id: resolvedAlbumId },
      select: { memorialId: true },
    });
    if (!album || album.memorialId !== id) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      );
    }
  }

  const imageId = crypto.randomUUID();
  const ext = getExtFromFileName(fileName || "file.mp4", "mp4");
  const s3Key = buildImageS3Key(id, imageId, ext);

  // Initiate multipart upload
  const uploadId = await createMultipartUpload(s3Key, contentType);

  // Calculate parts and generate presigned URLs
  const totalParts = Math.ceil(fileSize / MULTIPART_PART_SIZE);
  const parts: { partNumber: number; url: string }[] = [];

  for (let i = 1; i <= totalParts; i++) {
    const url = await generatePartUploadUrl(s3Key, uploadId, i);
    parts.push({ partNumber: i, url });
  }

  return NextResponse.json({
    uploadId,
    s3Key,
    imageId,
    albumId: resolvedAlbumId,
    mediaType: "VIDEO",
    partSize: MULTIPART_PART_SIZE,
    parts,
  });
});
