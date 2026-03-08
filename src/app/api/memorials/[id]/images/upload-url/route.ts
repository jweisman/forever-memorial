import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedMediaType,
  isVideoType,
  getExtFromFileName,
  generateUploadUrl,
  buildImageS3Key,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

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
  const { fileName, contentType, albumId } = body;

  if (!contentType || !isAllowedMediaType(contentType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, GIF images and MP4, WebM, MOV videos are allowed" },
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

  // Resolve album: use provided albumId or find/create default "Photos" album
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
    // Verify album belongs to this memorial
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
  const isVideo = isVideoType(contentType);
  const fallbackExt = isVideo ? "mp4" : "jpg";
  const ext = getExtFromFileName(fileName || `file.${fallbackExt}`, fallbackExt);
  const s3Key = buildImageS3Key(id, imageId, ext);

  if (isVideo) {
    const uploadUrl = await generateUploadUrl(s3Key, contentType);
    return NextResponse.json({
      uploadUrl,
      s3Key,
      imageId,
      albumId: resolvedAlbumId,
      mediaType: "VIDEO",
    });
  }

  const thumbS3Key = thumbKeyFromBase(s3Key);
  const fullS3Key = fullKeyFromBase(s3Key);

  const [thumbUploadUrl, fullUploadUrl] = await Promise.all([
    generateUploadUrl(thumbS3Key, "image/webp"),
    generateUploadUrl(fullS3Key, "image/webp"),
  ]);

  return NextResponse.json({
    thumbUploadUrl,
    fullUploadUrl,
    s3Key,
    thumbS3Key,
    fullS3Key,
    imageId,
    albumId: resolvedAlbumId,
    mediaType: "IMAGE",
  });
});
