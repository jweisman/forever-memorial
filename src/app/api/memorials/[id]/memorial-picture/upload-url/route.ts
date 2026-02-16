import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedImageType,
  getExtFromFileName,
  generateUploadUrl,
  buildMemorialPictureS3Key,
} from "@/lib/s3-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const uploadUrl = await generateUploadUrl(s3Key, contentType);

  return NextResponse.json({ uploadUrl, s3Key });
}
