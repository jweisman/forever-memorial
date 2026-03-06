import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserDisabled } from "@/lib/admin";
import {
  sendNotification,
  memoryAcceptedEmail,
  memoryReturnedEmail,
} from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type Params = { id: string; memoryId: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const { id, memoryId } = await params;

  const ip = getClientIp(request);
  const { success } = rateLimit({ key: `review:${ip}`, limit: 60, windowMs: 60_000 });
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
    select: { ownerId: true, name: true, slug: true },
  });

  if (!memorial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (memorial.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { submitter: { select: { email: true } } },
  });

  if (!memory || memory.memorialId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action, returnMessage } = body;

  if (!["accept", "ignore", "return"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be accept, ignore, or return" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};

  if (action === "accept") {
    data.status = "ACCEPTED";
    data.returnMessage = null;
  } else if (action === "ignore") {
    data.status = "IGNORED";
    data.returnMessage = null;
  } else if (action === "return") {
    if (!returnMessage?.trim()) {
      return NextResponse.json(
        { error: "Return message is required" },
        { status: 400 }
      );
    }
    data.status = "RETURNED";
    data.returnMessage = returnMessage.trim();
  }

  const updated = await prisma.memory.update({
    where: { id: memoryId },
    data,
  });

  // Notify the memory submitter
  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  if (memory.submitter.email) {
    if (action === "accept") {
      const email = memoryAcceptedEmail({
        memorialName: memorial.name,
        memorialUrl: `${baseUrl}/memorial/${memorial.slug}`,
      });
      after(() => sendNotification({ to: memory.submitter.email, ...email }));
    } else if (action === "return") {
      const email = memoryReturnedEmail({
        memorialName: memorial.name,
        returnMessage: returnMessage.trim(),
        dashboardUrl: `${baseUrl}/dashboard`,
      });
      after(() => sendNotification({ to: memory.submitter.email, ...email }));
    }
  }

  return NextResponse.json(updated);
}
