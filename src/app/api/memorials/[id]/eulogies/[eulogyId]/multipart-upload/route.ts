import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isVideoType,
  getExtFromFileName,
  buildEulogyImageS3Key,
  createMultipartUpload,
  generatePartUploadUrl,
  MULTIPART_PART_SIZE,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

type Params = { id: string; eulogyId: string };

/** POST — Initiate a multipart upload for a large video on a eulogy. */
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

  if (eulogy.memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, contentType, fileSize } = body;

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

  const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
  if (fileSize > MAX_VIDEO_SIZE) {
    return NextResponse.json(
      { error: "Video must be 500MB or smaller" },
      { status: 400 }
    );
  }

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
  const ext = getExtFromFileName(fileName || "file.mp4", "mp4");
  const s3Key = buildEulogyImageS3Key(id, eulogyId, imageId, ext);

  const uploadId = await createMultipartUpload(s3Key, contentType);

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
    mediaType: "VIDEO",
    partSize: MULTIPART_PART_SIZE,
    parts,
  });
});
