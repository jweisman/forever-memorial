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

type Params = { id: string; eulogyId: string };

/** POST — Complete a multipart upload for a eulogy video. */
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
  const { uploadId, s3Key, imageId, parts } = body;

  if (!uploadId || !s3Key || !imageId || !Array.isArray(parts)) {
    return NextResponse.json(
      { error: "uploadId, s3Key, imageId, and parts are required" },
      { status: 400 }
    );
  }

  const keyPattern = new RegExp(
    `^memorials/${id}/eulogies/${eulogyId}/[^/]+\\.(mp4|webm|mov)$`
  );
  if (!keyPattern.test(s3Key)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
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

  await completeMultipartUpload(s3Key, uploadId, parts);

  const image = await prisma.eulogyImage.create({
    data: {
      id: imageId,
      eulogyId,
      s3Key,
      mediaType: MediaType.VIDEO,
    },
  });

  const url = await generateViewUrl(s3Key);

  return NextResponse.json({ ...image, thumbUrl: url, url }, { status: 201 });
});
