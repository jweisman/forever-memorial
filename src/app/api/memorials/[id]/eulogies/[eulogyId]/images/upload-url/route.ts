import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedMediaType,
  isVideoType,
  getExtFromFileName,
  generateUploadUrl,
  buildEulogyImageS3Key,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

type Params = { id: string; eulogyId: string };

export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id, eulogyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const eulogy = await prisma.eulogy.findUnique({
    where: { id: eulogyId },
    include: { memorial: { select: { ownerId: true } } },
  });

  if (!eulogy || eulogy.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only memorial owner can upload eulogy images
  if (eulogy.memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, contentType } = body;

  if (!contentType || !isAllowedMediaType(contentType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, GIF images and MP4, WebM, MOV videos are allowed" },
      { status: 400 }
    );
  }

  // Max 5 images per eulogy
  const imageCount = await prisma.eulogyImage.count({
    where: { eulogyId },
  });
  if (imageCount >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 images per eulogy" },
      { status: 400 }
    );
  }

  const imageId = crypto.randomUUID();
  const isVideo = isVideoType(contentType);
  const fallbackExt = isVideo ? "mp4" : "jpg";
  const ext = getExtFromFileName(fileName || `file.${fallbackExt}`, fallbackExt);
  const s3Key = buildEulogyImageS3Key(id, eulogyId, imageId, ext);

  if (isVideo) {
    const uploadUrl = await generateUploadUrl(s3Key, contentType);
    return NextResponse.json({ uploadUrl, s3Key, imageId, mediaType: "VIDEO" });
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
    mediaType: "IMAGE",
  });
});
