import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-error";

export const GET = withHandler(async () => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", detail: "database unreachable" }, { status: 503 });
  }
});
