"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import SignOutButton from "@/components/SignOutButton";

export default function HeaderAuth() {
  const { data: session } = useSession();

  if (session?.user) {
    return (
      <>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-warm-600 transition-colors hover:text-accent"
        >
          {session.user.name || "Dashboard"}
        </Link>
        <SignOutButton />
      </>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="text-sm font-medium text-warm-600 transition-colors hover:text-accent"
    >
      Sign in
    </Link>
  );
}
