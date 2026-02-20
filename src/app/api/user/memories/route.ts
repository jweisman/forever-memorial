import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await prisma.memory.findMany({
    where: { submitterId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      memorial: { select: { id: true, name: true, slug: true } },
      images: true,
    },
  });

  const memoriesWithUrls = await Promise.all(
    memories.map(async (memory) => ({
      ...memory,
      images: await Promise.all(
        memory.images.map(async (img) => ({
          ...img,
          thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
          url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
        }))
      ),
    }))
  );

  return NextResponse.json(memoriesWithUrls);
}
