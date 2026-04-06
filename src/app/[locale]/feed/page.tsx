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
  hebrewDate: string;
  placeOfDeath: string | null;
  pictureUrl: string | null;
  updatedAt: string;
};

function formatDeathDate(dateOfDeath: string): string {
  return new Date(dateOfDeath).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
    <>
      {/* Branded hero banner */}
      <section className="relative overflow-hidden px-4 py-10 sm:py-12">
        <picture aria-hidden="true">
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.jpg" />
          <source media="(min-width: 769px)" srcSet="/images/hero-desktop.jpg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-desktop.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-warm-100/80" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="font-heading text-2xl font-semibold tracking-tight text-warm-800 sm:text-3xl">
            {t("heroTitle")}
            <br />
            <span className="font-[family-name:var(--font-logo-he)] text-3xl text-gold-500 sm:text-4xl" lang="he">{t("heroAccent")}</span>
          </p>
          <p className="mt-2 text-sm text-warm-500">{t("heroSubtitle")}</p>
        </div>
      </section>

    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading title={t("title")} as="h1" align="start" />

      {loadingActivity || loadingPages ? (
        <div className="mt-10 space-y-10">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-warm-100" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-warm-100" />
            ))}
          </div>
        </div>
      ) : activity.length === 0 && legacyPages.length === 0 ? (
        /* Unified empty state — no followed or owned legacies */
        <div className="mt-16 text-center">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("emptyDescription")}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/search" variant="secondary" size="sm">
              {t("searchLegacies")}
            </Button>
            <Button href="/dashboard/create" variant="primary" size="sm">
              {t("createLegacyPage")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {/* Recently shared memories */}
          {activity.length > 0 && (
            <section>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("recentActivity")}
              </h2>
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
                            className="font-heading font-semibold text-warm-800 hover:text-accent"
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
            </section>
          )}

          {/* Legacies I Follow */}
          {legacyPages.length > 0 && (
            <section>
              <h2 className="font-heading text-lg font-semibold text-warm-800">
                {t("latestLegacyPages")}
              </h2>
              <div className="mt-4 space-y-3">
                {legacyPages.map((page) => (
                  <MemorialCard
                    key={page.id}
                    name={page.name}
                    dates={`${formatDeathDate(page.dateOfDeath)} · ${page.hebrewDate}`}
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
            </section>
          )}

          <div className="pt-2">
            <Button href="/dashboard/create" variant="primary" size="sm">
              {t("createLegacyPage")}
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
