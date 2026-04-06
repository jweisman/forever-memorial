import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedImageType,
  getExtFromFileName,
  generateUploadUrl,
  buildMemorialPictureS3Key,
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
  const { fileName, contentType } = body;

  if (!contentType || !isAllowedImageType(contentType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 }
    );
  }

  const ext = getExtFromFileName(fileName || "image.jpg");
  const s3Key = buildMemorialPictureS3Key(id, ext);
  const thumbS3Key = thumbKeyFromBase(s3Key);
  const fullS3Key = fullKeyFromBase(s3Key);
  const [thumbUploadUrl, fullUploadUrl] = await Promise.all([
    generateUploadUrl(thumbS3Key, "image/webp"),
    generateUploadUrl(fullS3Key, "image/webp"),
  ]);

  return NextResponse.json({ thumbUploadUrl, fullUploadUrl, s3Key, thumbS3Key, fullS3Key });
});
