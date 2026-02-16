"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm font-medium text-warm-600 transition-colors hover:text-accent"
    >
      Sign out
    </button>
  );
}
