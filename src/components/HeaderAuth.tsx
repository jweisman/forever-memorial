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

        {/* Desktop: dashboard link + name + sign out */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-accent transition-colors hover:text-gold-600"
          >
            {t("dashboard")}
          </Link>
          <span className="text-warm-300" aria-hidden="true">|</span>
          <span className="text-sm text-warm-500">
            {session.user.name}
          </span>
          <SignOutButton />
        </div>
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
