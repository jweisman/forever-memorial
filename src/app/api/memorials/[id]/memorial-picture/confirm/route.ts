import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object, generateViewUrl } from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Delete old memorial picture from S3 if it exists
  if (memorial.memorialPicture) {
    try {
      await deleteS3Object(memorial.memorialPicture);
    } catch {
      // Ignore deletion errors for old file
    }
  }

  await prisma.memorial.update({
    where: { id },
    data: { memorialPicture: s3Key },
  });

  const url = await generateViewUrl(s3Key);

  return NextResponse.json({ url, s3Key });
}
