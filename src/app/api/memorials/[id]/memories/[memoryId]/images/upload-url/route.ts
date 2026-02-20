import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedImageType,
  getExtFromFileName,
  generateUploadUrl,
  buildMemoryImageS3Key,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";

type Params = { id: string; memoryId: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const { id, memoryId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { memorial: { select: { ownerId: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only submitter or memorial owner can upload images
  if (
    memory.submitterId !== session.user.id &&
    memory.memorial.ownerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, contentType } = body;

  if (!contentType || !isAllowedImageType(contentType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 }
    );
  }

  // Max 5 images per memory
  const imageCount = await prisma.memoryImage.count({
    where: { memoryId },
  });
  if (imageCount >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 images per memory" },
      { status: 400 }
    );
  }

  const imageId = crypto.randomUUID();
  const ext = getExtFromFileName(fileName || "image.jpg");
  const s3Key = buildMemoryImageS3Key(id, memoryId, imageId, ext);
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
  });
}
