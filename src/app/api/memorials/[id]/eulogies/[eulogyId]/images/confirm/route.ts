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

  if (eulogy.memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { imageId, s3Key, caption, mediaType: rawMediaType } = body;
  const mediaType: MediaType =
    rawMediaType === "VIDEO" ? MediaType.VIDEO : MediaType.IMAGE;

  if (!imageId || !s3Key) {
    return NextResponse.json(
      { error: "imageId and s3Key are required" },
      { status: 400 }
    );
  }

  // Validate s3Key belongs to this memorial/eulogy
  const expectedPrefix = `memorials/${id}/eulogies/${eulogyId}/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  // Re-check 5-image limit
  const imageCount = await prisma.eulogyImage.count({
    where: { eulogyId },
  });
  if (imageCount >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 images per eulogy" },
      { status: 400 }
    );
  }

  const image = await prisma.eulogyImage.create({
    data: {
      id: imageId,
      eulogyId,
      s3Key,
      caption: caption?.trim() || null,
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
