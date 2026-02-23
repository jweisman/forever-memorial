"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function SignOutButton() {
  const t = useTranslations("HeaderAuth");

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm font-medium text-warm-600 transition-colors hover:text-accent"
    >
      {t("signOut")}
    </button>
  );
}
