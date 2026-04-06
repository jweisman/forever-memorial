import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object, generateViewUrl, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";
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
    select: { ownerId: true, memorialPicture: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { s3Key } = body;

  if (!s3Key) {
    return NextResponse.json({ error: "s3Key is required" }, { status: 400 });
  }

  // Validate the key belongs to this memorial and matches expected naming
  const validKeyPattern = new RegExp(
    `^memorials/${id}/memorial-picture(_thumb|_full)?\\.(webp|jpg|jpeg|png|gif)$`
  );
  if (!validKeyPattern.test(s3Key)) {
    return NextResponse.json({ error: "Invalid s3Key" }, { status: 400 });
  }

  // Delete old memorial picture variants from S3 if key changed
  if (memorial.memorialPicture && memorial.memorialPicture !== s3Key) {
    const oldThumb = thumbKeyFromBase(memorial.memorialPicture);
    const oldFull = fullKeyFromBase(memorial.memorialPicture);
    await Promise.all([
      deleteS3Object(oldThumb).catch(() => {}),
      deleteS3Object(oldFull).catch(() => {}),
    ]);
  }

  await prisma.memorial.update({
    where: { id },
    data: { memorialPicture: s3Key },
  });

  const url = await generateViewUrl(thumbKeyFromBase(s3Key));

  return NextResponse.json({ url, s3Key });
});
