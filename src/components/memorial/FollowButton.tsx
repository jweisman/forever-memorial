"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  memorialId: string;
  initialFollowing: boolean;
};

export default function FollowButton({ memorialId, initialFollowing }: Props) {
  const t = useTranslations("Memorial");
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = following ? "DELETE" : "POST";
    const res = await fetch(`/api/memorials/${memorialId}/follow`, { method });
    if (res.ok) {
      setFollowing(!following);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover"
          : "border-border text-warm-600 hover:border-accent hover:text-accent"
      }`}
    >
      {following ? t("following") : t("follow")}
    </button>
  );
}
