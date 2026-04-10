"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function SignOutButton() {
  const t = useTranslations("HeaderAuth");

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      style={{ fontFamily: "var(--font-body)" }}
      className="cursor-pointer text-sm text-warm-400 transition-colors hover:text-warm-600"
    >
      {t("signOut")}
    </button>
  );
}
