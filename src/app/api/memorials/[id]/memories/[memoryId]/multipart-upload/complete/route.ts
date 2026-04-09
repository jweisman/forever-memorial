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

type Params = { id: string; memoryId: string };

/** POST — Complete a multipart upload for a memory video. */
export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id, memoryId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { memorial: { select: { ownerId: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    memory.submitterId !== session.user.id &&
    memory.memorial.ownerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { uploadId, s3Key, imageId, parts } = body;

  if (!uploadId || !s3Key || !imageId || !Array.isArray(parts)) {
    return NextResponse.json(
      { error: "uploadId, s3Key, imageId, and parts are required" },
      { status: 400 }
    );
  }

  // Validate s3Key belongs to this memorial/memory
  const keyPattern = new RegExp(
    `^memorials/${id}/memories/${memoryId}/[^/]+\\.(mp4|webm|mov)$`
  );
  if (!keyPattern.test(s3Key)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  // Re-check 5-image limit
  const imageCount = await prisma.memoryImage.count({
    where: { memoryId },
  });
  if (imageCount >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 images per memory" },
      { status: 400 }
    );
  }

  // Complete the S3 multipart upload
  await completeMultipartUpload(s3Key, uploadId, parts);

  // Create DB record
  const image = await prisma.memoryImage.create({
    data: {
      id: imageId,
      memoryId,
      s3Key,
      mediaType: MediaType.VIDEO,
    },
  });

  const url = await generateViewUrl(s3Key);

  return NextResponse.json({ ...image, thumbUrl: url, url }, { status: 201 });
});
