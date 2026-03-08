import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateViewUrl,
  thumbKeyFromBase,
  fullKeyFromBase,
} from "@/lib/s3-helpers";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async () => {
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
        memory.images.map(async (img) => {
          if (img.mediaType === "VIDEO") {
            const url = await generateViewUrl(img.s3Key);
            return { ...img, thumbUrl: url, url };
          }
          return {
            ...img,
            thumbUrl: await generateViewUrl(thumbKeyFromBase(img.s3Key)),
            url: await generateViewUrl(fullKeyFromBase(img.s3Key)),
          };
        })
      ),
    }))
  );

  return NextResponse.json(memoriesWithUrls);
});
