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
  const { imageId, s3Key, caption, mediaType: rawMediaType } = body;
  const mediaType: MediaType =
    rawMediaType === "VIDEO" ? MediaType.VIDEO : MediaType.IMAGE;

  if (!imageId || !s3Key) {
    return NextResponse.json(
      { error: "imageId and s3Key are required" },
      { status: 400 }
    );
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

  const image = await prisma.memoryImage.create({
    data: {
      id: imageId,
      memoryId,
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
}
