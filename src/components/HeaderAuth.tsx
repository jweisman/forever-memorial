"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SignOutButton from "@/components/SignOutButton";

function UserAvatarIcon({ name }: { name?: string | null }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-warm-100 text-sm font-semibold text-warm-700">
      {initial}
    </span>
  );
}

export default function HeaderAuth() {
  const { data: session } = useSession();
  const t = useTranslations("HeaderAuth");

  if (session?.user) {
    return (
      <>
        {/* Mobile: avatar icon linking to dashboard */}
        <Link
          href="/dashboard"
          className="sm:hidden"
          aria-label={t("dashboardLabel")}
        >
          <UserAvatarIcon name={session.user.name} />
        </Link>

        {/* Desktop: name + sign out */}
        <Link
          href="/dashboard"
          className="hidden text-sm font-medium text-warm-600 transition-colors hover:text-accent sm:inline"
        >
          {session.user.name || t("dashboard")}
        </Link>
        <span className="hidden sm:inline">
          <SignOutButton />
        </span>
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
