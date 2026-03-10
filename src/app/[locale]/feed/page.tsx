"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import MemorialCard from "@/components/ui/MemorialCard";

const TAKE = 5;

type ActivityItem = {
  id: string;
  name: string | null;
  relation: string | null;
  text: string;
  createdAt: string;
  memorial: { id: string; slug: string; name: string };
};

type LegacyPageItem = {
  id: string;
  slug: string;
  name: string;
  birthday: string | null;
  dateOfDeath: string;
  placeOfDeath: string | null;
  pictureUrl: string | null;
  updatedAt: string;
};

function formatDateRange(birthday: string | null, dateOfDeath: string, diedLabel: string): string {
  const deathYear = new Date(dateOfDeath).getFullYear();
  if (birthday) {
    return `${new Date(birthday).getFullYear()} – ${deathYear}`;
  }
  return diedLabel;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function FeedPage() {
  const { data: session, status } = useSession();
  const t = useTranslations("Feed");
  const router = useRouter();

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Activity state
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activitySkip, setActivitySkip] = useState(0);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);

  // Legacy pages state
  const [legacyPages, setLegacyPages] = useState<LegacyPageItem[]>([]);
  const [legacyTotal, setLegacyTotal] = useState(0);
  const [legacySkip, setLegacySkip] = useState(0);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingMorePages, setLoadingMorePages] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchInitial() {
      const [actRes, pagesRes] = await Promise.all([
        fetch(`/api/feed/activity?skip=0&take=${TAKE}`),
        fetch(`/api/feed/legacy-pages?skip=0&take=${TAKE}`),
      ]);
      if (actRes.ok) {
        const data = await actRes.json();
        setActivity(data.items);
        setActivityTotal(data.total);
        setActivitySkip(data.items.length);
      }
      setLoadingActivity(false);

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setLegacyPages(data.items);
        setLegacyTotal(data.total);
        setLegacySkip(data.items.length);
      }
      setLoadingPages(false);
    }

    fetchInitial();
  }, [status]);

  async function loadMoreActivity() {
    setLoadingMoreActivity(true);
    const res = await fetch(`/api/feed/activity?skip=${activitySkip}&take=${TAKE}`);
    if (res.ok) {
      const data = await res.json();
      setActivity((prev) => [...prev, ...data.items]);
      setActivitySkip((prev) => prev + data.items.length);
    }
    setLoadingMoreActivity(false);
  }

  async function loadMorePages() {
    setLoadingMorePages(true);
    const res = await fetch(`/api/feed/legacy-pages?skip=${legacySkip}&take=${TAKE}`);
    if (res.ok) {
      const data = await res.json();
      setLegacyPages((prev) => [...prev, ...data.items]);
      setLegacySkip((prev) => prev + data.items.length);
    }
    setLoadingMorePages(false);
  }

  if (status === "loading" || status === "unauthenticated") return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <SectionHeading title={t("title")} as="h1" align="start" />
        <Button href="/dashboard/create" variant="primary" size="sm">
          {t("createLegacyPage")}
        </Button>
      </div>

      <div className="mt-10 space-y-10">
        {/* Recent Activity */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            {t("recentActivity")}
          </h2>

          {loadingActivity ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-warm-100" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("noActivity")}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {activity.map((item) => (
                <Card key={item.id} padding="sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-warm-700">
                        <span className="font-medium text-warm-800">
                          {item.name ?? t("anonymous")}
                        </span>
                        {item.relation && (
                          <span className="text-warm-400"> · {item.relation}</span>
                        )}
                        {" "}
                        {t("sharedMemory")}{" "}
                        <Link
                          href={`/memorial/${item.memorial.slug}#memories`}
                          className="font-medium text-accent hover:text-accent-hover"
                        >
                          {item.memorial.name}
                        </Link>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-warm-500">
                        {item.text}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-warm-300">
                      {formatRelativeDate(item.createdAt)}
                    </span>
                  </div>
                </Card>
              ))}
              {activity.length < activityTotal && (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreActivity}
                    disabled={loadingMoreActivity}
                  >
                    {t("loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Latest Legacy Pages */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-warm-800">
            {t("latestLegacyPages")}
          </h2>

          {loadingPages ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-warm-100" />
              ))}
            </div>
          ) : legacyPages.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("noLegacyPages")}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {legacyPages.map((page) => (
                <MemorialCard
                  key={page.id}
                  name={page.name}
                  dates={formatDateRange(
                    page.birthday,
                    page.dateOfDeath,
                    t("died", { year: new Date(page.dateOfDeath).getFullYear() })
                  )}
                  placeOfDeath={page.placeOfDeath ?? undefined}
                  imageUrl={page.pictureUrl ?? undefined}
                  href={`/memorial/${page.slug}`}
                />
              ))}
              {legacyPages.length < legacyTotal && (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMorePages}
                    disabled={loadingMorePages}
                  >
                    {t("loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
