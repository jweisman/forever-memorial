import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { MediaType } from "@/generated/prisma/enums";
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
  const { imageId, s3Key, albumId, caption, mediaType: rawMediaType } = body;
  const mediaType: MediaType =
    rawMediaType === "VIDEO" ? MediaType.VIDEO : MediaType.IMAGE;

  if (!imageId || !s3Key || !albumId) {
    return NextResponse.json(
      { error: "imageId, s3Key, and albumId are required" },
      { status: 400 }
    );
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

  // Get next order value
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
      mediaType,
    },
  });

  let thumbUrl: string;
  let url: string;
  if (mediaType === MediaType.VIDEO) {
    url = await generateViewUrl(s3Key);
    thumbUrl = url;
  } else {
    [thumbUrl, url] = await Promise.all([
      generateViewUrl(thumbKeyFromBase(s3Key)),
      generateViewUrl(fullKeyFromBase(s3Key)),
    ]);
  }

  return NextResponse.json({ ...image, thumbUrl, url }, { status: 201 });
});
