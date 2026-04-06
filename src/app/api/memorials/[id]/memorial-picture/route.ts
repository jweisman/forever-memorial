import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteS3Object, thumbKeyFromBase, fullKeyFromBase } from "@/lib/s3-helpers";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

export const DELETE = withHandler(async (
  _request: Request,
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

  if (memorial.memorialPicture) {
    await Promise.all([
      deleteS3Object(thumbKeyFromBase(memorial.memorialPicture)).catch(() => {}),
      deleteS3Object(fullKeyFromBase(memorial.memorialPicture)).catch(() => {}),
    ]);
  }

  await prisma.memorial.update({
    where: { id },
    data: { memorialPicture: null },
  });

  return NextResponse.json({ success: true });
});
