import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { withHandler } from "@/lib/api-error";

type Params = { id: string };

export const POST = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id } = await params;

  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `follow:${ip}`, limit: 60, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isUserDisabled(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  const memorial = await prisma.memorial.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.memorialFollow.upsert({
    where: { userId_memorialId: { userId: session.user.id, memorialId: id } },
    create: { userId: session.user.id, memorialId: id },
    update: {},
  });

  return NextResponse.json({ following: true });
});

export const DELETE = withHandler(async (
  request: Request,
  { params }: { params: Promise<Params> }
) => {
  const { id } = await params;

  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `follow:${ip}`, limit: 60, windowMs: 60_000 });
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.memorialFollow.deleteMany({
    where: { userId: session.user.id, memorialId: id },
  });

  return NextResponse.json({ following: false });
});
