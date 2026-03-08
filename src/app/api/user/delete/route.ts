import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { withHandler } from "@/lib/api-error";

export const DELETE = withHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  // Cascade delete handles memorials, albums, images, eulogies, memories
  await prisma.user.delete({
    where: { id: session.user.id },
  });

  return NextResponse.json({ success: true });
});
