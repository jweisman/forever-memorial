"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SignOutButton from "@/components/SignOutButton";

export default function HeaderAuth() {
  const { data: session } = useSession();
  const t = useTranslations("HeaderAuth");

  if (session?.user) {
    return (
      <>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-warm-600 transition-colors hover:text-accent"
        >
          {session.user.name || t("dashboard")}
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
      {t("signIn")}
    </Link>
  );
}
