import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  completeMultipartUpload,
  generateViewUrl,
} from "@/lib/s3-helpers";
import { MediaType } from "@/generated/prisma/enums";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

/** POST — Complete a multipart upload and create the DB record. */
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
  const { uploadId, s3Key, imageId, albumId, caption, parts } = body;

  if (!uploadId || !s3Key || !imageId || !albumId || !Array.isArray(parts)) {
    return NextResponse.json(
      { error: "uploadId, s3Key, imageId, albumId, and parts are required" },
      { status: 400 }
    );
  }

  // Validate s3Key belongs to this memorial
  const keyPattern = new RegExp(`^memorials/${id}/images/[^/]+\\.(mp4|webm|mov)$`);
  if (!keyPattern.test(s3Key)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  // Verify album belongs to this memorial
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { memorialId: true },
  });
  if (!album || album.memorialId !== id) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  // Re-check 100-image limit
  const imageCount = await prisma.image.count({
    where: { album: { memorialId: id } },
  });
  if (imageCount >= 100) {
    return NextResponse.json(
      { error: "This memorial has reached the 100-image limit" },
      { status: 400 }
    );
  }

  // Complete the S3 multipart upload
  await completeMultipartUpload(s3Key, uploadId, parts);

  // Create DB record
  const maxOrder = await prisma.image.aggregate({
    where: { albumId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const image = await prisma.image.create({
    data: {
      id: imageId,
      albumId,
      s3Key,
      caption: caption?.trim() || null,
      order: nextOrder,
      mediaType: MediaType.VIDEO,
    },
  });

  const url = await generateViewUrl(s3Key);

  return NextResponse.json({ ...image, thumbUrl: url, url }, { status: 201 });
});
