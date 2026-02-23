import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Returns the session if the caller is an admin, or an error response.
 */
export async function requireAdmin(): Promise<
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

/**
 * Check if a user is disabled (banned). Used in API routes.
 */
export async function isUserDisabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true },
  });
  return user?.disabled ?? false;
}
