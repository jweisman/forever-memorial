import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteS3Object,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

type Params = { id: string; eulogyId: string; imageId: string };

export const DELETE = withHandler(async (
  _request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id, eulogyId, imageId } = await params;
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

  const image = await prisma.eulogyImage.findUnique({
    where: { id: imageId },
  });

  if (!image || image.eulogyId !== eulogyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete S3 objects — videos have a single key; images have thumb + full variants
  const keysToDelete =
    image.mediaType === "VIDEO"
      ? [image.s3Key]
      : [thumbKeyFromBase(image.s3Key), fullKeyFromBase(image.s3Key)];
  for (const key of keysToDelete) {
    try {
      await deleteS3Object(key);
    } catch {
      // Ignore S3 deletion errors
    }
  }

  await prisma.eulogyImage.delete({ where: { id: imageId } });

  return NextResponse.json({ success: true });
});
